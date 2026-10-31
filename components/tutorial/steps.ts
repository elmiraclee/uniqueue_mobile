export type TourAction =
  | "queue-type"
  | "service"
  | "quantity"
  | "period"
  | "year"
  | "requirements"
  | "review";
export type TourStep = {
  screen: string;
  target: string;
  title: string;
  body: string;
  phase?: string;
  action?: TourAction;
  task?: string;
};
/** V3 guided actions are all isolated in practice; real transactions are never submitted. */
export function clientTourSteps(role: "student" | "parent"): TourStep[] {
  return [
    {
      screen: `${role}/home`,
      target: "help",
      title: "A guide you can try",
      body: "Follow the highlighted controls. Queue practice uses sample data and never creates a real ticket.",
    },
    {
      screen: `${role}/home`,
      target: "dashboard",
      title:
        role === "parent" ? "Your family’s queues" : "Your queue at a glance",
      body:
        role === "parent"
          ? "Each linked child has separate tickets and records. Choose the correct child before queueing."
          : "Home keeps your active tickets, queue estimates and available offices together.",
    },
    ...(role === "parent"
      ? [
          {
            screen: "parent/add-child",
            target: "header",
            title: "Add or link a child",
            body: "Create an Elementary profile or request permission to link an existing student account.",
          },
        ]
      : []),
    {
      screen: role === "parent" ? "parent/queue" : "student/offices",
      target: "offices",
      title: "Start with an office",
      body: "Check availability and office hours before joining. Events may include several offices.",
    },
    {
      screen: "client-practice",
      target: "queue-type-walkin",
      phase: "type",
      title: "Choose how you’ll queue",
      body: "Walk-in joins the office queue. Appointment is for a scheduled visit with a physical slip.",
      action: "queue-type",
      task: "Tap the Walk-in card to try it.",
    },
    {
      screen: "client-practice",
      target: "service-1",
      phase: "services",
      title: "Pick a service",
      body: "Select a service card to reveal its copies and academic details.",
      action: "service",
      task: "Select Document Request (example).",
    },
    {
      screen: "client-practice",
      target: "quantity-1",
      phase: "services",
      title: "Set your copy count",
      body: "The + and − controls update the number of copies you’re requesting.",
      action: "quantity",
      task: "Use + to request two copies.",
    },
    {
      screen: "client-practice",
      target: "period-1",
      phase: "academic",
      title: "Choose an academic period",
      body: "Use “same details for all copies” when both copies cover the same period.",
      action: "period",
      task: "Select an academic period.",
    },
    {
      screen: "client-practice",
      target: "school-year-1",
      phase: "academic",
      title: "Choose the school year",
      body: "Academic details are checked for every copy before a real request can continue.",
      action: "year",
      task: "Select a school year.",
    },
    {
      screen: "client-practice",
      target: "requirements",
      phase: "requirements",
      title: "Prepare your requirements",
      body: "Only confirm documents you will bring to the office.",
      action: "requirements",
      task: "Check both sample requirements.",
    },
    {
      screen: "client-practice",
      target: "review-summary",
      phase: "review",
      title: "Check your request",
      body: "Check the office, copies, academic details and estimated total before confirming.",
    },
    {
      screen: "client-practice",
      target: "review-action",
      phase: "review",
      title: "Review, then try it",
      body: "Review your selections and create a sample ticket. This action cannot submit a real queue.",
      action: "review",
      task: "Tap Create practice ticket.",
    },
    {
      screen: "client-practice",
      target: "ticket",
      phase: "ticket",
      title: "This is your sample ticket",
      body: "A real ticket shows the queue number, assigned window and live status. This one is only a preview.",
    },
    {
      screen: `${role}/live-monitor`,
      target: "header",
      title: "Watch the live monitor",
      body: "Choose offices and windows to follow. Monitor chimes are optional and separate from device notifications.",
    },
    {
      screen: `${role}/history`,
      target: "header",
      title: "Find past transactions",
      body: "Search and filter your tickets, open timelines, and read submitted CSM feedback.",
    },
    {
      screen: "client-practice",
      target: "csm",
      phase: "csm",
      title: "Official feedback form",
      body: "A completed transaction opens the official multi-section CSM survey, not just a star rating. This preview never submits feedback.",
    },
    {
      screen: `${role}/notifications`,
      target: "header",
      title: "Never miss an update",
      body: "The inbox keeps queue calls and account notices together. Open a ticket or mark a notice as read.",
    },
    {
      screen: `${role}/profile`,
      target: "header",
      title: "Your account controls",
      body: "Edit your profile, manage linked accounts, and choose optional interface sounds and haptics.",
    },
    {
      screen: `${role}/home`,
      target: "help",
      title: "Ready for the real thing",
      body: "Practice created no records. Tap Finish to return to the app, or replay this guide from Help.",
    },
  ];
}
