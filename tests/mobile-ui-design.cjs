/** Local-only UI contract regressions for approved fixes; all remote requests intercepted. */
const fs = require("fs"),
  path = require("path"),
  http = require("http"),
  assert = require("assert/strict");
const { chromium } = require("playwright"),
  { createFixture } = require("./fixtures/api.cjs");
const root = path.resolve(__dirname, ".."),
  dist = path.join(root, "dist"),
  out =
    process.env.UQ_TEST_OUTPUT ||
    path.join(root, "validation/mobile-ui-design");
fs.mkdirSync(out, { recursive: true });
const api = require("../deployment.generated.json").api_url;
const server = http.createServer((req, res) => {
  let p = path.join(
    dist,
    decodeURIComponent(new URL(req.url, "http://local").pathname),
  );
  if (!p.startsWith(dist)) {
    res.writeHead(403);
    return res.end();
  }
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory())
    p = path.join(dist, "index.html");
  res.setHeader(
    "Content-Type",
    {
      ".js": "application/javascript",
      ".html": "text/html",
      ".css": "text/css",
      ".png": "image/png",
      ".ttf": "font/ttf",
      ".wav": "audio/wav",
    }[path.extname(p)] || "application/octet-stream",
  );
  fs.createReadStream(p).pipe(res);
});
(async () => {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({
    executablePath:
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || "/usr/local/bin/chromium",
    headless: true,
  });
  const errors = [],
    checks = [];
  try {
    for (const width of [320, 390, 1440]) {
      const state = createFixture();
      const ctx = await browser.newContext({
        viewport: { width, height: 844 },
        reducedMotion: "reduce",
        timezoneId: "Asia/Manila",
      });
      const page = await ctx.newPage();
      page.on("pageerror", (e) => errors.push(String(e)));
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
      const key =
        "uniqueue-session-v3." +
        api
          .split("")
          .map((c) => c.charCodeAt(0).toString(16).padStart(4, "0"))
          .join("");
      for (const role of ["student", "parent"]) {
        if (!page.url().startsWith(base)) await page.goto(base + "/login");
        await page.evaluate(
          ({ key, role, user, api }) => {
            localStorage.setItem("deployment_api_origin", api);
            localStorage.setItem("role", role);
            localStorage.setItem("user", JSON.stringify(user));
            localStorage.setItem(key, "isolated-fixture-token");
          },
          {
            key,
            role,
            api,
            user: role === "student" ? state.student : state.parent,
          },
        );
        await page.goto(base + "/" + role + "/home");
        await page.getByText("Alex Santos", { exact: true }).first().waitFor();
        for (const label of role === "parent"
          ? ["Home", "Add", "History", "Alerts", "Profile"]
          : ["Home", "Transactions", "Profile"]) {
          const fits = await page
            .getByText(label, { exact: true })
            .last()
            .evaluate((el) => {
              const style = getComputedStyle(el),
                canvas = document.createElement("canvas"),
                ctx = canvas.getContext("2d");
              ctx.font = style.font;
              return {
                actual: el.getBoundingClientRect().width,
                required: ctx.measureText(el.textContent).width,
                scroll: el.scrollWidth,
                client: el.clientWidth,
              };
            });
          assert(
            fits.actual + 1 >= fits.required,
            `${width} ${role} ${label} label is truncated: ${JSON.stringify(fits)}`,
          );
        }
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        );
        await page.screenshot({
          path: path.join(out, `${width}-${role}-navigation.png`),
        });
        checks.push(`${width} ${role} full navigation labels`);
      }
      await ctx.close();
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      path.join(out, "results.json"),
      JSON.stringify(
        { passed: checks.length, checks, runtimeErrors: errors },
        null,
        2,
      ),
    );
    console.log(
      `${checks.length} navigation design cases passed at 320/390/1440px; zero page exceptions.`,
    );
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  server.close();
  process.exitCode = 1;
});
