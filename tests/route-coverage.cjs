const fs = require("fs"),
  assert = require("node:assert/strict"),
  path = require("path");
const root = path.resolve(__dirname, "..");
const routes = {
  student: {
    "(tabs)/home": "portal/home",
    "(tabs)/queue": "portal/history",
    "(tabs)/profile": "account/profile",
    history: "portal/history",
    notifications: "portal/notifications",
    offices: "portal/offices",
    ticket: "portal/ticket",
    "live-monitor": "portal/monitor",
    "live-queue": "portal/monitor",
    "office-queue": "queue/wizard",
  },
  parent: {
    "(tabs)/home": "portal/home",
    "(tabs)/add-child": "account/add-child",
    "(tabs)/history": "portal/history",
    "(tabs)/notifications": "portal/notifications",
    "(tabs)/profile": "account/profile",
    queue: "portal/offices",
    ticket: "portal/ticket",
    "live-monitor": "portal/monitor",
    "live-queue": "portal/monitor",
    "office-queue": "queue/wizard",
  },
};
let count = 0;
for (const [role, entries] of Object.entries(routes))
  for (const [file, feature] of Object.entries(entries)) {
    const text = fs.readFileSync(
      path.join(root, "app", role, file + ".tsx"),
      "utf8",
    );
    assert(
      text.includes("features/" + feature),
      `${role}/${file} routes to ${feature}`,
    );
    count++;
  }
const tabs = fs.readFileSync(
  path.join(root, "features/portal/tabs.tsx"),
  "utf8",
);
for (const [name, title] of [
  ["home", "Home"],
  ["queue", "Transactions"],
  ["add-child", "Add"],
  ["history", "History"],
  ["notifications", "Alerts"],
  ["profile", "Profile"],
])
  assert.match(
    tabs,
    new RegExp(`tab\\(\\s*["']${name}["']\\s*,\\s*["']${title}["']`),
  );
for (const role of ["student", "parent"])
  assert(
    fs
      .readFileSync(path.join(root, "app", role, "_layout.tsx"), "utf8")
      .includes("features/portal/stack"),
  );
const wizard = fs.readFileSync(
  path.join(root, "features/queue/wizard.tsx"),
  "utf8",
);
assert.match(wizard, /mode:\s*['"]event['"]/);
assert.match(wizard, /mode:\s*['"]cashier['"]/);
assert(wizard.includes("regularPayload"));
assert(!wizard.includes("asParentParam"));
console.log(
  `${count} role route adapters, original role-specific navigation and all queue modes verified.`,
);
