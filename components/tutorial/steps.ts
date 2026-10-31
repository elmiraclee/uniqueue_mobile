export type TourStep = {
  screen: string;
  target: string;
  title: string;
  body: string;
  phase?: string;
};
const step = (
  screen: string,
  title: string,
  body: string,
  target = "portal",
  phase?: string,
): TourStep => ({ screen, target, title, body, phase });
/** Rebuilt route map. Practice is isolated and can never submit a real transaction. */
export function clientTourSteps(role: "student" | "parent"): TourStep[] {
  return [
    step(
      `${role}/home`,
      "Welcome to UniQueue",
      "Use the original mobile navigation. Students have Home, Transactions and Profile; parents have Home, Add, History, Alerts and Profile. The help icon replays this guide.",
    ),
    step(
      `${role}/home`,
      role === "parent" ? "Choose the right child" : "Your active tickets",
      role === "parent"
        ? "Select a linked child to inspect all their active and reserved tickets. Each child has separate queues and records."
        : "Home shows every active ticket, including reserved tickets waiting on another office. Open a ticket for its live estimate and controls.",
    ),
    ...(role === "parent"
      ? [
          step(
            "parent/add-child",
            "Add or link a child",
            "Add creates an Elementary profile. Link existing uses an exact school-record name and SR Code. Activated accounts require student approval at every level.",
          ),
        ]
      : []),
    step(
      role === "student" ? "student/offices" : "parent/queue",
      "Choose an office or event",
      "Availability, cutoff times, capacity and parent-queue rules come from the server. Events may span several offices. Request unavailable services from the button below the office list.",
    ),
    step(
      "client-practice",
      "Practice safely",
      "These are examples only. No ticket, payment, feedback or profile update can be submitted.",
      "queue-type",
      "type",
    ),
    step(
      "client-practice",
      "Queue type",
      "Walk-in joins the queue in person. An appointment requires your physical appointment slip.",
      "queue-type",
      "type",
    ),
    step(
      "client-practice",
      "Services and quantities",
      "Select your services and copy counts. Some services have required options and academic details for every copy.",
      "service-1",
      "services",
    ),
    step(
      "client-practice",
      "Academic details",
      "Choose a period and school year for each requested copy.",
      "academic-1",
      "academic",
    ),
    step(
      "client-practice",
      "Requirements",
      "Confirm the listed requirements. Appointment holders confirm their appointment slip instead.",
      "requirements",
      "requirements",
    ),
    step(
      "client-practice",
      "Review before joining",
      "Check services, options, copies, fees and priority. Unknown fees are not shown as a complete total. Parent queueing also requires physical ID / authorization confirmation.",
      "review",
      "review",
    ),
    step(
      "client-practice",
      "Your ticket",
      "Follow the assigned window when called. ETA can change. Reserved tickets activate after the previous office completes. Skipped tickets need a rejoin or cancel response.",
      "ticket",
      "ticket",
    ),
    step(
      `${role}/live-monitor`,
      "Live office monitor",
      "Choose an office and window. Expand tickets for details. Manage office visibility on this device; chimes are optional and separate from system notifications.",
    ),
    step(
      `${role}/history`,
      "History and feedback",
      "Search and filter tickets, open timelines and read submitted CSM comments. Pending CSM for an office must be completed before queueing there again.",
    ),
    step(
      "client-practice",
      "Official CSM",
      "CSM uses the official multi-section form, not a star-only rating. Practice cannot submit a response.",
      "csm",
      "csm",
    ),
    step(
      `${role}/notifications`,
      "Notifications",
      "Unread updates include queue calls and account notices. Open the associated ticket or mark the notice as read.",
    ),
    step(
      `${role}/profile`,
      "Profile and account security",
      "Edit your profile, change your password, and manage linked accounts. Unlinking ends parent access but does not delete profiles or history.",
    ),
    step(
      `${role}/home`,
      "You’re ready",
      "Practice created no records. Replay Help whenever you need a refresher. Sign out on shared devices and only approve guardians you recognise.",
    ),
  ];
}
