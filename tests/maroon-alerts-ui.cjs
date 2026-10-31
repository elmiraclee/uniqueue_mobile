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
    process.env.UQ_TEST_OUTPUT || path.join(root, "validation/maroon-alerts");
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
  const checks = [],
    errors = [];
  const check = (v, label) => {
    assert(v, label);
    checks.push(label);
    console.log("PASS", label);
  };
  try {
    for (const width of [320, 390])
      for (const role of ["student", "parent"]) {
        const state = createFixture();
        const ctx = await browser.newContext({
          viewport: { width, height: 844 },
          reducedMotion: "reduce",
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
            const a = state.handle(url, body, req.method());
            return route.fulfill({
              status: a.status,
              contentType: "application/json",
              headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
              },
              body: JSON.stringify(a.data),
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
        await page.goto(base + "/login");
        await page.evaluate(
          ({ api, role, user, key }) => {
            localStorage.setItem("deployment_api_origin", api);
            localStorage.setItem("role", role);
            localStorage.setItem("user", JSON.stringify(user));
            localStorage.setItem(key, "fixture-token");
          },
          {
            api,
            role,
            key,
            user: role === "student" ? state.student : state.parent,
          },
        );
        await page.goto(base + `/${role}/home`);
        await page.getByText("Alex Santos", { exact: true }).first().waitFor();
        const snap = async (name) => {
          await page.waitForTimeout(180);
          check(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
            `${width} ${role} ${name} no horizontal overflow`,
          );
          await page.screenshot({
            path: path.join(out, `${width}-${role}-${name}.png`),
          });
        };
        await snap("home");
        await page
          .getByRole("button", { name: "Open account menu", exact: true })
          .click();
        await page
          .getByTestId("account-dropdown")
          .getByRole("button", { name: "Logout", exact: true })
          .waitFor();
        await snap("account-menu");
        await page
          .getByRole("button", { name: "View profile", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Edit profile", exact: true })
          .waitFor();
        check(
          page.url().includes(`/${role}/profile`),
          `${width} ${role} avatar profile link`,
        );
        await page
          .getByRole("button", { name: "Open account menu", exact: true })
          .click();
        await page
          .getByTestId("account-dropdown")
          .getByRole("button", { name: "Logout", exact: true })
          .click();
        await page
          .getByText("Logout from this device?", { exact: true })
          .waitFor();
        await snap("logout-confirmation");
        await page.getByRole("button", { name: "Cancel", exact: true }).click();
        check(
          !page.url().includes("/login"),
          `${width} ${role} cancel logout retains session`,
        );
        await page.goto(base + `/${role}/home`);
        await page
          .getByRole("button", { name: "Open account menu", exact: true })
          .waitFor();
        const event = (ahead, type = "position_update") => ({
          id: 100 + ahead,
          event_id: `fixture-${width}-${role}-${type}-${ahead}`,
          ticket_id: 41,
          type,
          ahead,
          is_read: false,
          expires_at: Math.floor(Date.now() / 1000) + 180,
          message: `${ahead} people ahead`,
          created_at: "2026-10-31 06:00:00",
        });
        state.ticket.people_ahead = 5;
        state.notifications = [event(5)];
        await page
          .getByText("5 people ahead", { exact: true })
          .waitFor({ timeout: 15000 });
        await snap("five-ahead");
        // A new live count replaces, rather than queues behind, the unacknowledged modal.
        state.ticket.people_ahead = 4;
        state.notifications.unshift(event(4));
        await page
          .getByText("4 people ahead", { exact: true })
          .waitFor({ timeout: 15000 });
        check(
          (await page.getByText("5 people ahead", { exact: true }).count()) ===
            0,
          `${width} ${role} current four replaces stale five`,
        );
        await page
          .getByRole("button", { name: "OK — Got It", exact: true })
          .click();
        await page.waitForTimeout(2700);
        check(
          (await page
            .getByRole("button", { name: "OK — Got It", exact: true })
            .count()) === 0,
          `${width} ${role} acknowledged event does not reopen`,
        );
        check(
          page.url().includes("/home"),
          `${width} ${role} countdown OK stays on home`,
        );
        for (const ahead of [3, 2, 1]) {
          state.ticket.people_ahead = ahead;
          state.notifications.unshift(event(ahead));
          await page
            .getByText(`${ahead} ${ahead === 1 ? "person" : "people"} ahead`, {
              exact: true,
            })
            .waitFor({ timeout: 15000 });
          if (ahead === 1) await snap("one-ahead");
          await page
            .getByRole("button", { name: "OK — Got It", exact: true })
            .click();
          checks.push(`${width} ${role} ${ahead} countdown acknowledged`);
        }
        // A stale near-turn event must never show while the authoritative ticket is farther away.
        state.ticket.people_ahead = 6;
        state.notifications.unshift({
          ...event(5),
          id: 200,
          event_id: `stale-${width}-${role}`,
        });
        await page.waitForTimeout(2800);
        check(
          (await page
            .getByRole("button", { name: "OK — Got It", exact: true })
            .count()) === 0,
          `${width} ${role} stale proximity rejected`,
        );
        state.ticket.people_ahead = 2;
        state.notifications.unshift({
          ...event(2),
          id: 250,
          event_id: `cancel-check-${width}-${role}`,
        });
        await page
          .getByText("2 people ahead", { exact: true })
          .waitFor({ timeout: 15000 });
        state.ticket.status = "cancelled";
        await page
          .getByRole("button", { name: "OK — Got It", exact: true })
          .waitFor({ state: "hidden", timeout: 15000 });
        check(
          true,
          `${width} ${role} cancelled ticket dismisses invalid prompt`,
        );
        state.ticket.status = "called";
        state.notifications.unshift({ ...event(0, "called"), id: 300 });
        await page
          .getByText("Please Proceed Now", { exact: true })
          .waitFor({ timeout: 15000 });
        await snap("called");
        await page
          .getByRole("button", { name: "OK — I'm Going", exact: true })
          .click();
        await page.getByText("Your ticket", { exact: true }).waitFor();
        check(
          page.url().includes("/ticket"),
          `${width} ${role} turn acknowledgement opens ticket`,
        );
        await page
          .getByRole("button", { name: "Open account menu", exact: true })
          .click();
        await page
          .getByTestId("account-dropdown")
          .getByRole("button", { name: "Logout", exact: true })
          .click();
        await page
          .getByText("Logout from this device?", { exact: true })
          .waitFor();
        await page.getByTestId("account-dropdown").waitFor({ state: "hidden" });
        await page.getByRole("button", { name: "Logout", exact: true }).click();
        await page.waitForURL("**/login");
        check(
          !(await page.evaluate((key) => localStorage.getItem(key), key)),
          `${width} ${role} header Logout clears session and returns to login`,
        );
        await ctx.close();
      }
    check(errors.length === 0, "zero browser runtime exceptions");
    fs.writeFileSync(
      path.join(out, "results.json"),
      JSON.stringify(
        { passed: checks.length, checks, runtimeErrors: errors },
        null,
        2,
      ),
    );
    console.log(`${checks.length} maroon/header/countdown UI checks passed.`);
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  server.close();
  process.exitCode = 1;
});
