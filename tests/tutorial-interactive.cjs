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
  out =
    process.env.UQ_TEST_OUTPUT ||
    path.join(root, "validation/tutorial-refresh");
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
      viewport: {
        width,
        height: Number(process.env.UQ_TUTORIAL_HEIGHT) || 844,
      },
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
      const coach = (await page.getByTestId("tutorial-coach").count())
          ? await page.getByTestId("tutorial-coach").boundingBox()
          : null,
        highlight = (await page.getByTestId("tutorial-highlight").count())
          ? await page.getByTestId("tutorial-highlight").boundingBox()
          : null;
      if (coach && highlight) {
        assert(
          coach.y >= 0 &&
            coach.y + coach.height <= page.viewportSize().height + 1,
          "Coach outside viewport: " + name,
        );
        assert(
          !(
            coach.x < highlight.x + highlight.width &&
            coach.x + coach.width > highlight.x &&
            coach.y < highlight.y + highlight.height &&
            coach.y + coach.height > highlight.y
          ),
          "Coach overlaps target: " + name,
        );
      }
      await page.screenshot({ path: path.join(out, name + ".png") });
      results.push(name);
    };
    return { page, ctx, state, go, snap };
  }
  try {
    const a = await session(
      "student",
      Number(process.env.UQ_TUTORIAL_WIDTH) || 390,
    );
    const { page, go, snap, state } = a;
    const next = async () => {
      await page
        .getByRole("button", { name: "Next tutorial step", exact: true })
        .click();
      await page.waitForTimeout(500);
    };
    const gate = () =>
      page.getByRole("button", { name: "Next tutorial step", exact: true });
    await go("/student/home");
    await page
      .getByRole("button", { name: "Open guided tutorial", exact: true })
      .click();
    await page.getByTestId("tutorial-coach").waitFor();
    await snap("01-intro");
    assert.equal(await page.getByTestId("tutorial-coach").count(), 1);
    assert(
      (await page.getByTestId("tutorial-stage").boundingBox()).height >=
        (Number(process.env.UQ_TUTORIAL_HEIGHT) || 844) - 4,
      "Overlay must not shrink the app",
    );
    await next();
    await next();
    await next();
    await page.getByRole("radio", { name: "Walk-in", exact: true }).waitFor();
    assert(await gate().isDisabled(), "Action gate starts disabled");
    await snap("02-type-action");
    await page.getByRole("radio", { name: "Walk-in", exact: true }).click();
    assert(await gate().isEnabled());
    await snap("03-type-completed");
    await next();
    await page
      .getByRole("checkbox", {
        name: "Document Request (example)",
        exact: true,
      })
      .click();
    await next();
    await page
      .getByRole("button", {
        name: "Increase copies · Document Request (example)",
        exact: true,
      })
      .click();
    await snap("04-copy-counter");
    await next();
    assert.equal(await page.getByRole('radio',{name:/Regular copy|Certified copy/}).count(),0);
    assert(await gate().isDisabled());
    await page
      .getByLabel("Academic period", { exact: true })
      .selectOption("First Semester");
    await snap("06-academic-period");
    await next();
    await page
      .getByLabel("School year", { exact: true })
      .selectOption("2026-2027");
    await snap("07-academic-year");
    await next();
    await page
      .getByRole("checkbox", { name: "School ID (example)", exact: true })
      .click();
    assert(await gate().isDisabled());
    await page
      .getByRole("checkbox", {
        name: "Completed request form (example)",
        exact: true,
      })
      .click();
    await snap("08-requirements");
    await next();
    await snap("08b-review-summary");
    await next();
    assert(await gate().isDisabled());
    await page
      .getByRole("button", { name: "Create practice ticket", exact: true })
      .click();
    await snap("09-review");
    await next();
    await snap("10-sample-ticket");
    assert.equal(
      state.writes.filter(
        (w) => !["mobile_tour.php", "check_notification.php"].includes(w.file),
      ).length,
      0,
      "Practice made a real write",
    );
    await next();
    await next();
    await next();
    await snap("11-csm");
    await next();
    await next();
    await next();
    await page
      .getByRole("button", { name: "Finish tutorial", exact: true })
      .click();
    await page.waitForTimeout(500);
    assert.equal(await page.getByTestId("tutorial-coach").count(), 0);
    assert(
      await page.evaluate(() =>
        Object.entries(localStorage).some(
          ([k, v]) =>
            k.startsWith("client-tour:native:4:student:") &&
            JSON.parse(v).status === "completed",
        ),
      ),
    );
    assert.deepEqual(
      state.writes.filter(
        (w) => !["mobile_tour.php", "check_notification.php"].includes(w.file),
      ),
      [],
      "No real record mutations in the complete guide",
    );
    results.push(
      "Action-gated full student walkthrough completes without real queue, payment, profile or CSM writes",
    );
    await a.ctx.close();
    for (const width of [320, 1100]) {
      const b = await session("student", width);
      await b.go("/student/home");
      await b.page
        .getByRole("button", { name: "Open guided tutorial", exact: true })
        .click();
      await b.page.getByTestId("tutorial-coach").waitFor();
      await b.snap(`${width}-intro`);
      for (let i = 0; i < 3; i++) {
        await b.page
          .getByRole("button", { name: "Next tutorial step", exact: true })
          .click();
        await b.page.waitForTimeout(500);
      }
      await b.snap(`${width}-type`);
      await b.page.getByRole("radio", { name: "Walk-in", exact: true }).click();
      assert(
        await b.page
          .getByRole("button", { name: "Next tutorial step", exact: true })
          .isEnabled(),
      );
      await b.page
        .getByRole("button", { name: "Pause tutorial", exact: true })
        .click();
      assert.equal(await b.page.getByTestId("tutorial-coach").count(), 0);
      await b.snap(`${width}-paused`);
      await b.page
        .getByRole("button", { name: "Resume tutorial", exact: true })
        .click();
      await b.page.getByTestId("tutorial-coach").waitFor();
      await b.page.keyboard.press("Escape");
      await b.page
        .getByRole("button", { name: "Exit queue practice", exact: true })
        .click();
      await b.page.waitForTimeout(500);
      assert(b.page.url().endsWith("/student/home"));
      results.push(`${width}px pause/resume, escape and exit`);
      await b.ctx.close();
    }
    const p = await session("parent");
    await p.go("/parent/home");
    await p.page
      .getByRole("button", { name: "Open guided tutorial", exact: true })
      .click();
    for (let i = 0; i < 4; i++) {
      await p.page
        .getByRole("button", { name: "Next tutorial step", exact: true })
        .click();
      await p.page.waitForTimeout(500);
    }
    await p.snap("12-parent-type");
    await p.page.getByRole("radio", { name: "Walk-in", exact: true }).click();
    assert(
      await p.page
        .getByRole("button", { name: "Next tutorial step", exact: true })
        .isEnabled(),
    );
    await p.page
      .getByRole("button", { name: "Skip tutorial", exact: true })
      .click();
    await p.page.waitForTimeout(500);
    assert(p.page.url().endsWith("/parent/home"));
    await p.ctx.close();
    const resumed = await session("student");
    await resumed.ctx.addInitScript(() =>
      localStorage.setItem(
        "client-tour:native:4:student:7",
        JSON.stringify({ step: 6, status: "active" }),
      ),
    );
    await resumed.go("/student/home");
    await resumed.page
      .getByRole("button", { name: "Open guided tutorial", exact: true })
      .click();
    await resumed.page
      .getByRole("heading", { name: "Choose an academic period", exact: true })
      .waitFor();
    assert(
      await resumed.page
        .getByRole("button", { name: "Next tutorial step", exact: true })
        .isDisabled(),
    );
    await resumed.page.getByLabel('Academic period',{exact:true}).selectOption('First Semester');
    assert(
      await resumed.page
        .getByRole("button", { name: "Next tutorial step", exact: true })
        .isEnabled(),
    );
    await resumed.page
      .getByRole("button", { name: "Pause tutorial", exact: true })
      .click();
    await resumed.page
      .getByRole("button", { name: "Exit queue practice", exact: true })
      .click();
    await resumed.page.waitForTimeout(400);
    assert(resumed.page.url().endsWith("/student/home"));
    results.push(
      "Stored v3 progress restores the correct lesson and still requires its practice action",
    );
    await resumed.ctx.close();
    const realForm = await session("student");
    await realForm.go("/student/office-queue?office=registrar");
    await realForm.snap("13-actual-queue-type");
    await realForm.page
      .getByRole("button", { name: "Continue", exact: true })
      .click();
    await realForm.page
      .getByRole("checkbox", { name: "Transcript of Records", exact: true })
      .click();
    await realForm.page
      .getByRole("button", {
        name: "Increase copies · Transcript of Records",
        exact: true,
      })
      .click();
    await realForm.page
      .getByRole("checkbox", {
        name: "Use the same academic details for all copies · Transcript of Records",
        exact: true,
      })
      .click();
    await realForm.page
      .getByLabel("Academic period", { exact: true })
      .selectOption("First Semester");
    await realForm.page
      .getByLabel("School year", { exact: true })
      .selectOption("2026-2027");
    await realForm.page
      .getByRole("button", {
        name: "Increase copies · Transcript of Records",
        exact: true,
      })
      .click();
    assert.equal(
      await realForm.page
        .getByLabel("Academic period", { exact: true })
        .count(),
      1,
    );
    await realForm.page
      .getByLabel("Academic period", { exact: true })
      .scrollIntoViewIfNeeded();
    await realForm.snap("14-actual-shared-academic-details");
    await realForm.page
      .getByRole("checkbox", {
        name: "Use the same academic details for all copies · Transcript of Records",
        exact: true,
      })
      .click();
    assert.equal(
      await realForm.page
        .getByLabel("Academic period", { exact: true })
        .count(),
      3,
    );
    for (const field of await realForm.page
      .getByLabel("Academic period", { exact: true })
      .all())
      assert.equal(await field.inputValue(), "First Semester");
    for (const field of await realForm.page
      .getByLabel("School year", { exact: true })
      .all())
      assert.equal(await field.inputValue(), "2026-2027");
    await realForm.page
      .getByRole("button", {
        name: "Decrease copies · Transcript of Records",
        exact: true,
      })
      .click();
    assert.equal(
      await realForm.page
        .getByLabel("Academic period", { exact: true })
        .count(),
      2,
    );
    results.push(
      "Real form shares tutorial controls; same-details, new copies and individual-copy mode preserve academic values",
    );
    await realForm.ctx.close();
    assert.deepEqual(errors, [], "Runtime exceptions");
    fs.writeFileSync(
      path.join(out, "tutorial-results.json"),
      JSON.stringify(
        { passed: results.length, checks: results, runtimeErrors: errors },
        null,
        2,
      ),
    );
    console.log(`${results.length} tutorial checks passed.`);
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
