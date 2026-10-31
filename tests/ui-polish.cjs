/* Real Expo Web bundle + Playwright + isolated PHP contract fixtures.
 * No real API host, sign-in, queue, payment, or account write is contacted. */
const fs = require("node:fs"),
  path = require("node:path"),
  http = require("node:http"),
  assert = require("node:assert/strict");
const { chromium } = require("playwright"),
  { createFixture } = require("./fixtures/api.cjs");
const root = path.resolve(__dirname, ".."),
  dist = path.join(root, "dist"),
  out = process.env.UQ_TEST_OUTPUT || path.join(root, "validation/ui-refresh");
if (!fs.existsSync(dist))
  throw Error("Build first: npx expo export --platform web");
fs.mkdirSync(out, { recursive: true });
const mime = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".wav": "audio/wav",
  ".svg": "image/svg+xml",
};
const server = http.createServer((req, res) => {
  let name = decodeURIComponent(new URL(req.url, "http://localhost").pathname),
    file = path.join(dist, name);
  if (!file.startsWith(dist)) {
    res.writeHead(403);
    return res.end();
  }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory())
    file = path.join(file, "index.html");
  if (!fs.existsSync(file))
    file = fs.existsSync(file + ".html")
      ? file + ".html"
      : path.join(dist, "index.html");
  res.setHeader(
    "Content-Type",
    mime[path.extname(file)] || "application/octet-stream",
  );
  fs.createReadStream(file).pipe(res);
});
(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`,
    deployment = require("../deployment.generated.json"),
    api = deployment.api_url;
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : fs.existsSync("/usr/bin/chromium")
        ? { executablePath: "/usr/bin/chromium" }
        : {}),
  });
  const results = [],
    errors = [];
  async function session(role, width = 390) {
    const state = createFixture();
    const ctx = await browser.newContext({
      viewport: { width, height: 844 },
      reducedMotion: "reduce",
    });
    const page = await ctx.newPage();
    page.on("console", (m) => {
      if (m.type() === "warning" || m.type() === "error")
        console.log("CONSOLE", m.text());
    });
    page.on("pageerror", (e) => {
      errors.push(String(e));
      console.error("PAGE ERROR", String(e));
    });
    await ctx.route("**/*", async (route) => {
      const req = route.request(),
        url = req.url();
      if (url.startsWith(api + "/")) {
        let body = {};
        try {
          body = req.postDataJSON() || {};
        } catch {}
        const answer = state.handle(url, body, req.method());
        return route.fulfill({
          status: answer.status,
          contentType: "application/json",
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
          },
          body: JSON.stringify(answer.data),
        });
      }
      if (
        url.startsWith(base) ||
        url.startsWith("data:") ||
        url.startsWith("blob:")
      )
        return route.continue();
      return route.abort();
    });
    const user = role === "student" ? state.student : state.parent,
      sessionKey =
        "uniqueue-session-v3." +
        api
          .split("")
          .map((c) => c.charCodeAt(0).toString(16).padStart(4, "0"))
          .join("");
    await ctx.addInitScript(
      ({ api, user, role, sessionKey }) => {
        localStorage.setItem("deployment_api_origin", api);
        if (role === "guest") return;
        localStorage.setItem("user", JSON.stringify(user));
        localStorage.setItem("role", role);
        localStorage.setItem(sessionKey, "fixture-session-not-a-real-token");
      },
      { api, user, role, sessionKey },
    );
    const go = async (route) => {
      await page.goto(base + route);
      await page
        .getByRole("button", { name: "Open guided tutorial" })
        .waitFor({ timeout: 30000 });
    };
    const snap = async (name) => {
      await page.waitForTimeout(350);
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        "Horizontal page overflow: " + name,
      );
      await page.screenshot({ path: path.join(out, name + ".png") });
      results.push(name);
    };
    return { page, ctx, state, go, snap };
  }
  try {
    const compact = await session("student", 320);
    await compact.go("/student/home");
    await compact.page.getByText("Current Queue", { exact: true }).waitFor();
    await compact.snap("30-compact-home");
    await compact.ctx.close();
    const guest = await session("guest");
    await guest.page.goto(base + "/login");
    await guest.page
      .getByRole("button", { name: "Login", exact: true })
      .waitFor();
    await guest.snap("31-login");
    await guest.page
      .getByRole("button", { name: "Parent sign in", exact: true })
      .click();
    await guest.snap("32-parent-login");
    await guest.page.goto(base + "/signup");
    await guest.page
      .getByText("Create Account", { exact: true })
      .first()
      .waitFor();
    await guest.snap("33-signup");
    await guest.page.goto(base + "/activate-account");
    await guest.page
      .getByText("Activate Student Account", { exact: true })
      .waitFor();
    await guest.snap("34-activation");
    await guest.page
      .getByRole("button", { name: "Send activation code", exact: true })
      .click();
    await guest.page.getByText("Use YY-NNNNN.", { exact: true }).waitFor();
    await guest.snap("35-validation-dialog");
    await guest.page.goto(base + "/parent-signup");
    await guest.page.getByText("Parent / Guardian Sign up", { exact: true }).waitFor();
    await guest.snap("36-parent-signup");
    await guest.page.goto(base + "/forgot-password");
    await guest.page.getByText("Forgot password", { exact: true }).waitFor();
    await guest.snap("37-password-recovery");
    await guest.ctx.close();
    assert.deepEqual(errors, [], "Runtime exceptions");
    fs.writeFileSync(
      path.join(out, "polish-results.json"),
      JSON.stringify(
        { passed: results.length, checks: results, runtimeErrors: errors },
        null,
        2,
      ),
    );
    console.log(`${results.length} additional UI checks passed.`);
  } catch (e) {
    for (const ctx of browser.contexts())
      for (const pg of ctx.pages()) {
        await pg.screenshot({ path: path.join(out, "failure.png") });
        console.error((await pg.locator("body").innerText()).slice(0, 4500));
      }
    throw e;
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  server.close();
  process.exitCode = 1;
});
