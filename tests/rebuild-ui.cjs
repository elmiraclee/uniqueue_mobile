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
    process.env.UQ_TEST_OUTPUT || path.join(root, "validation/original-design");
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
    const a = await session("student");
    const { page, state, go, snap } = a;
    await go("/student/home");
    await page.getByText("Current Queue", { exact: true }).waitFor();
    await snap("01-student-home");
    assert.equal(await page.getByRole("tab").count(), 3);
    await page.getByRole("tab", { name: /Transactions/ }).click();
    await page.getByLabel("Search transactions").waitFor();
    await snap("25-original-student-transactions");
    results.push("original student three-tab navigation to Transactions");
    await go("/student/home");
    await page
      .getByRole("button", { name: /Notifications, .* unread/ })
      .click();
    await page
      .getByRole("button", { name: "View all notifications", exact: true })
      .waitFor();
    await snap("23-original-notification-sheet");
    await page
      .getByRole("button", { name: "View all notifications", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Mark all as read", exact: true })
      .waitFor();
    results.push("original bell sheet opens full functional inbox");
    state.pending = true;
    await go("/student/home");
    await page.getByText("Complete your CSM", { exact: true }).waitFor();
    results.push("student feedback endpoint transactions[] normalization");
    state.pending = false;
    await go("/student/offices");
    await page
      .getByRole("button", { name: "Join Queue", exact: true })
      .first()
      .waitFor();
    await snap("02-student-offices");
    await go("/student/office-queue?office=registrar");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page
      .getByRole("checkbox", { name: "Transcript of Records", exact: true })
      .click();
    await page.getByLabel("Copies · Transcript of Records").selectOption("2");
    await page.getByLabel("Option · Transcript of Records").selectOption("2");
    for (const combo of await page
      .getByLabel("Academic period", { exact: true })
      .all())
      await combo.selectOption("First Semester");
    for (const combo of await page
      .getByLabel("School year", { exact: true })
      .all())
      await combo.selectOption("2026-2027");
    await snap("03-service-details");
    await page
      .getByRole("button", { name: "Continue to requirements" })
      .click();
    await page
      .getByRole("checkbox", { name: "Valid school ID", exact: true })
      .click();
    await page
      .getByRole("checkbox", { name: "Request authorization", exact: true })
      .click();
    await snap("04-requirements");
    await page
      .getByRole("button", { name: "Review request", exact: true })
      .click();
    await snap("05-review");
    await page
      .getByRole("button", { name: "Confirm & join queue", exact: true })
      .click();
    await page.getByText("You’re in the queue", { exact: true }).waitFor();
    await snap("06-queue-success");
    const write = state.writes.find((w) => w.file === "office-queue.php");
    assert.equal(write.body.service_items[0].quantity, 2);
    assert.equal(write.body.service_items[0].academic.length, 2);
    assert.equal(
      state.writes.filter((w) => w.file === "office-queue.php").length,
      1,
    );
    results.push("regular request payload and single submission");
    await go("/student/ticket?ticketId=41");
    await page.getByText("3 people ahead", { exact: true }).waitFor();
    await snap("07-live-ticket");
    state.ticket = { ...state.ticket, is_requeued: true };
    await go("/student/ticket?ticketId=41");
    await page
      .getByRole("button", { name: "Rejoin queue", exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Rejoin queue", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Rejoin queue", exact: true })
      .last()
      .click();
    await page.getByText("3 people ahead", { exact: true }).waitFor();
    results.push("skipped ticket requeue action");
    state.fail = "get_ticket_detail.php";
    await go("/student/ticket?ticketId=41");
    await page.getByText(/Test connection interrupted/).waitFor();
    await snap("08-ticket-error");
    state.fail = null;
    await go("/student/history");
    await page
      .getByRole("button", { name: "View timeline & CSM", exact: true })
      .click();
    await page
      .getByText("Clear instructions and helpful staff.", { exact: true })
      .waitFor();
    await page.getByText("Timeline", { exact:true }).scrollIntoViewIfNeeded();
    await snap("09-history-expanded");
    await go("/student/live-monitor");
    await page.getByText("Now serving", { exact: true }).waitFor();
    await snap("10-live-monitor");
    await page.getByRole("button", { name: "Manage visible offices" }).click();
    await snap("11-monitor-preferences");
    state.notifications = [
      {
        id: -5,
        type: "relationship_unlinked",
        title: "Relationship updated",
        message: "Parent access has ended. Your profile and history are kept.",
        is_read: false,
        created_at: "2026-10-30 10:00:00",
        ticket_id: 0,
      },
    ];
    await go("/student/notifications");
    await page.getByText("Relationship updated", { exact: true }).waitFor();
    await snap("12-notifications");
    await page
      .getByRole("button", { name: "Mark all as read", exact: true })
      .click();
    await page.getByText("0 unread", { exact: true }).waitFor();
    results.push("signed account notice ID preserved on marking read");
    await go("/student/profile");
    await page
      .getByRole("button", { name: "View profile photo", exact: true })
      .waitFor();
    await snap("26-original-student-profile");
    await page
      .getByRole("button", { name: "View profile photo", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Close photo", exact: true })
      .waitFor();
    await snap("24-original-photo-viewer");
    await page
      .getByRole("button", { name: "Close photo", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Edit profile", exact: true })
      .click();
    await snap("13-student-profile-edit");
    await go("/student/office-queue?office=registrar&event_id=8");
    await page.getByText("Original school ID", { exact: true }).waitFor();
    await snap("14-event-current-step");
    await page
      .getByRole("checkbox", { name: "Original school ID", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Join current event step", exact: true })
      .click();
    await page.getByText("You’re in the queue", { exact: true }).waitFor();
    assert(
      state.writes.some(
        (w) =>
          w.file === "office-queue.php" &&
          w.body.mode === "event" &&
          w.body.req_check[0] === 5,
      ),
    );
    results.push("event requirements and current-step payload");
    await go("/student/office-queue?office=cashier");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("checkbox", { name: "#REG-006 · Registrar" }).click();
    await snap("15-cashier-payment");
    await page.getByRole("button", { name: "Join payment queue" }).click();
    await page.getByText("You’re in the queue", { exact: true }).waitFor();
    assert(
      state.writes.some(
        (w) => w.body.mode === "cashier" && w.body.source_ticket_id === 40,
      ),
    );
    results.push("cashier source-ticket payload");
    await a.ctx.close();
    const b = await session("parent");
    await b.go("/parent/home");
    await b.page.getByText("Linked children", { exact: true }).waitFor();
    await b.snap("16-parent-home");
    await b.page
      .getByRole("button", { name: "View ticket", exact: true })
      .first()
      .click();
    await b.page.getByText("Alex Santos · 26-12345", { exact: true }).waitFor();
    results.push(
      "parent all-child dashboard opens correctly scoped live ticket",
    );
    await b.go("/parent/home");
    assert.equal(await b.page.getByRole("tab").count(), 5);
    await b.page.getByRole("tab", { name: /Add/ }).click();
    await b.page
      .getByRole("button", { name: "Link existing", exact: true })
      .waitFor();
    results.push("original parent five-tab navigation with Add");
    await b.go("/parent/queue");
    await b.page
      .getByText("Select a child before choosing an office.", { exact: true })
      .waitFor();
    await b.snap("17-parent-child-required");
    await b.page
      .getByRole("button", { name: "Alex Santos", exact: true })
      .click();
    await b.page
      .getByRole("button", { name: "Join Queue", exact: true })
      .first()
      .click();
    await b.page.getByRole("button", { name: "Continue", exact: true }).click();
    await b.page
      .getByRole("checkbox", { name: "Transcript of Records", exact: true })
      .click();
    await b.page.getByLabel("Option · Transcript of Records").selectOption("2");
    await b.page
      .getByLabel("Academic period", { exact: true })
      .selectOption("First Semester");
    await b.page
      .getByLabel("School year", { exact: true })
      .selectOption("2026-2027");
    await b.page
      .getByRole("button", { name: "Continue to requirements" })
      .click();
    await b.page
      .getByRole("checkbox", { name: "Valid school ID", exact: true })
      .click();
    await b.page
      .getByRole("checkbox", { name: "Request authorization", exact: true })
      .click();
    await b.page
      .getByRole("button", { name: "Review request", exact: true })
      .click();
    await b.snap("18-parent-proof");
    await b.page.getByRole("button", { name: "Confirm & join queue" }).click();
    await b.page
      .getByText("Confirm physical ID / authorization at the counter.", {
        exact: true,
      })
      .waitFor();
    assert(!b.state.writes.some((w) => w.file === "office-queue.php"));
    await b.page
      .getByRole("checkbox", {
        name: "I will present physical ID / authorization at the counter",
      })
      .click();
    await b.page.getByRole("button", { name: "Confirm & join queue" }).click();
    await b.page.getByText("You’re in the queue", { exact: true }).waitFor();
    const parentWrite = b.state.writes.find(
      (w) => w.file === "office-queue.php",
    );
    assert.equal(parentWrite.body.parent_id, 3);
    assert.equal(parentWrite.body.student_id, 7);
    assert.equal(parentWrite.body.parent_proof_confirmed, true);
    results.push("parent proof gate and separate parent/child identity");
    await b.go("/parent/add-child");
    await b.page
      .getByRole("button", { name: "Link existing", exact: true })
      .click();
    await b.page.getByLabel("First name", { exact: true }).fill("Alex");
    await b.page.getByLabel("Last name", { exact: true }).fill("Santos");
    await b.page
      .getByLabel("SR Code · YY-NNNNN", { exact: true })
      .fill("2612345");
    await b.page
      .getByText("Details match the school record.", { exact: true })
      .waitFor();
    await b.snap("19-parent-link-child");
    await b.page
      .getByRole("button", { name: "Link / request approval", exact: true })
      .click();
    await b.page
      .getByText("Student approval requested.", { exact: true })
      .waitFor();
    results.push("parent child matching and approval request");
    await b.go("/parent/profile");
    await b.page.getByRole("button", { name: "Edit profile" }).waitFor();
    await b.snap("20-parent-account");
    b.state.children = [];
    await b.go("/parent/home");
    await b.page.getByText("No linked children yet", { exact: true }).waitFor();
    await b.snap("21-parent-empty");
    await b.ctx.close();
    const desktop = await session("student", 1100);
    await desktop.go("/student/home");
    await desktop.page.getByText("Current Queue", { exact: true }).waitFor();
    await desktop.snap("22-desktop-responsive");
    await desktop.ctx.close();
    assert.deepEqual(errors, [], "Runtime exceptions");
    fs.writeFileSync(
      path.join(out, "ui-results.json"),
      JSON.stringify(
        { passed: results.length, checks: results, runtimeErrors: errors },
        null,
        2,
      ),
    );
    console.log(`${results.length} browser checks passed; screenshots: ${out}`);
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
