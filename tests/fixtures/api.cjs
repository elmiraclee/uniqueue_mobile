/** Deterministic local fixtures only. Never used by the production application. */
exports.createFixture = () => {
  const office = {
    id: 1,
    name: "Registrar",
    slug: "registrar",
    description: "Student records and academic documents",
    transaction_type: "request",
    can_join: true,
    is_full: false,
    walkin_enabled: true,
    appointment_enabled: true,
    priority_enabled: true,
    parent_queue_enabled: true,
    open_time: "08:00:00",
    close_time: "17:00:00",
    cutoff_time: "16:30:00",
  };
  const cashier = {
      ...office,
      id: 2,
      name: "Cashier",
      slug: "cashier",
      transaction_type: "payment",
    },
    student = {
      id: 7,
      first_name: "Alex",
      last_name: "Santos",
      sr_code: "26-12345",
      school_level: "College",
      grade_year: "1st Year",
      college_id: 1,
      program_id: 1,
      email: "alex@example.test",
      grade_version: 1,
    },
    child = {
      ...student,
      relationship: "Guardian",
      link_id: 9,
      active_queue_number: "REG-007",
      active_office: "Registrar",
      active_count: 1,
    };
  const parent = {
    id: 3,
    full_name: "Maria Santos",
    email: "maria@example.test",
    contact_number: "09123456789",
  };
  const service = {
    id: 11,
    name: "Transcript of Records",
    category: "Academic records",
    amount: 100,
    price: 100,
    pay_at_cashier: true,
    use_academic_period: true,
    requirements: ["Valid school ID"],
    choices: [
      {
        id: 2,
        label: "Official copy",
        requirements: ["Request authorization"],
      },
    ],
  };
  const ticket = {
    id: 41,
    student_id: 7,
    queue_number: "REG-007",
    status: "waiting",
    type: "walkin",
    office_id: 1,
    office_name: "Registrar",
    window_name: "Window 1",
    first_name: "Alex",
    last_name: "Santos",
    sr_code: "26-12345",
    people_ahead: 3,
    estimated_label: "About 12 minutes",
    estimated_wait_minutes: 12,
    estimated_call_time: "10:15 AM",
    can_cancel: true,
    all_windows_closed: false,
    created_at: "2026-10-30 10:00:00",
    joined_at: "2026-10-30 10:00:00",
    service_items: [
      {
        ...service,
        item_id: 101,
        service_item_id: 11,
        quantity: 1,
        academic: [
          {
            copy_number: 1,
            academic_period: "First Semester",
            school_year: "2026-2027",
          },
        ],
      },
    ],
  };
  const history = {
    ...ticket,
    id: 40,
    queue_number: "REG-006",
    status: "completed",
    service_items: "Transcript of Records (x2)",
    done_at: "2026-10-30 10:30:00",
    feedback_rating: 5,
    feedback_comment: "Clear instructions and helpful staff.",
    has_feedback: true,
  };
  const state = {
    writes: [],
    ticket,
    office,
    student,
    child,
    parent,
    children: [child],
    pending: false,
    fail: null,
    notifications: [],
    eventComplete: false,
    eventActive: null,
    stepId: 91,
  };
  state.handle = (url, body, method) => {
    const u = new URL(url),
      file = u.pathname.split("/").pop();
    if (state.fail === file)
      return {
        status: 503,
        data: { success: false, message: "Test connection interrupted" },
      };
    const ok = (data) => ({ status: 200, data: { success: true, ...data } });
    if (
      method === "POST" &&
      !file.startsWith("get_") &&
      !["public_live_queue.php", "parent_check_child.php"].includes(file)
    )
      state.writes.push({ file, body });
    switch (file) {
      case "get_offices.php":
        return ok({
          offices: [state.office, cashier],
          stats: { open_offices: 2, total_waiting: 8 },
        });
      case "queue_process.php":
        return ok({
          office:
            u.searchParams.get("slug") === "cashier" ? cashier : state.office,
        });
      case "get_student_profile.php":
        return ok({ student: state.student });
      case "get_parent_profile.php":
        return ok({ user: state.parent, children: state.children });
      case "get_parent_children.php":
        return ok({ children: state.children });
      case "get_student_linked_parents.php":
        return ok({
          parents: [
            { link_id: 9, full_name: "Maria Santos", relationship: "Guardian" },
          ],
        });
      case "get_parent_link_requests.php":
        return ok({ requests: [] });
      case "get_colleges.php":
        return {
          status: 200,
          data: [{ college_id: 1, college_name: "College of Engineering" }],
        };
      case "get_programs.php":
        return {
          status: 200,
          data: [{ program_id: 1, program_name: "BS Computer Engineering" }],
        };
      case "get_grade_options.php":
        return ok({
          grades: [
            {
              school_level: "College",
              value: "1st Year",
              label: "1st Year",
              active: true,
            },
            {
              school_level: "Elementary",
              value: "Grade 1",
              label: "Grade 1",
              active: true,
            },
          ],
        });
      case "get_queue_details.php":
        return ok({ queue: state.ticket });
      case "get_current_queue.php":
        return ok({
          queue: state.ticket,
          queues: state.ticket.status === "cancelled" ? [] : [state.ticket],
        });
      case "get_pending_feedback.php":
        return ok({
          pending: state.pending,
          transactions: state.pending
            ? [
                {
                  ticket_id: 40,
                  queue_number: "REG-006",
                  office_id: 1,
                  office_name: "Registrar",
                  type: "walkin",
                  created_at: "2026-10-30 10:00:00",
                },
              ]
            : [],
        });
      case "get_parent_pending_feedback.php":
        return ok({
          pending: state.pending
            ? [
                {
                  ticket_id: 40,
                  student_id: 7,
                  first_name: "Alex",
                  last_name: "Santos",
                  office_id: 1,
                  office_name: "Registrar",
                  queue_number: "REG-006",
                },
              ]
            : [],
        });
      case "get_ticket_detail.php":
        return ok({ ticket: state.ticket });
      case "get_student_transaction.php":
      case "get_parent_transactions.php":
        return ok({
          transactions: [history],
          children: state.children,
          stats: { total: 2, active: 1, completed: 1, cancelled: 0 },
          total: 1,
          total_pages: 1,
          page: 1,
        });
      case "get_account_notifications.php":
      case "get_notification.php":
      case "get_parent_notifications.php":
        return ok({
          notifications: state.notifications,
          unread_count: state.notifications.filter((n) => !n.is_read).length,
        });
      case "check_notification.php":
        return ok({ has_notification: false });
      case "mark_notification_read.php":
        state.notifications.forEach((n) => {
          if (!body.notification_id || body.notification_id === n.id)
            n.is_read = true;
        });
        return ok({});
      case "get_service_items.php":
        return ok({ service_items: [service] });
      case "get_academic_data.php":
        return ok({
          academic_period_enabled: 1,
          periods: [
            { id: 1, label: "First Semester" },
            { id: 2, label: "Second Semester" },
          ],
          school_years: [{ id: 1, school_year: "2026-2027" }],
        });
      case "get_payable_tickets.php":
        return ok({
          payable_tickets: [
            {
              ticket_id: 40,
              queue_number: "REG-006",
              source_office_name: "Registrar",
              service_items: [
                { name: "Transcript of Records", quantity: 1, amount: 100 },
              ],
              total: 100,
              amount_complete: true,
            },
          ],
        });
      case "prequeue_check.php":
        return ok({ allowed: true });
      case "get_possible_windows.php":
        return ok({ windows: [{ name: "Window 1" }] });
      case "get_unavailable_services.php":
        return ok({ services: [] });
      case "office-queue.php":
        if (method === "POST")
          return ok({
            ticket_id: 42,
            queue_number: "REG-008",
            window_name: "Window 1",
            message: "Your ticket is ready.",
          });
        if (u.searchParams.get("action") === "events")
          return ok({
            events: [
              {
                id: 8,
                office_id: 1,
                name: "Enrollment",
                description: "Registrar and payment steps",
              },
            ],
          });
        return ok({
          event: { id: 8, name: "Enrollment" },
          steps: [
            {
              id: 91,
              title: "Submit documents",
              office_id: 1,
              office_name: "Registrar",
              service_items: [
                {
                  service_item_id: 11,
                  name: "Transcript of Records",
                  quantity: 1,
                  requirements: [{ id: 5, requirement: "Original school ID" }],
                },
              ],
            },
            {
              id: 92,
              title: "Pay fees",
              office_id: 2,
              office_name: "Cashier",
              service_items: [],
            },
          ],
          current_step: {
            id: state.stepId,
            title: state.stepId === 91 ? "Submit documents" : "Pay fees",
            office_id: state.stepId === 91 ? 1 : 2,
            office_name: state.stepId === 91 ? "Registrar" : "Cashier",
            service_items:
              state.stepId === 91
                ? [
                    {
                      service_item_id: 11,
                      name: "Transcript of Records",
                      quantity: 1,
                      requirements: [
                        { id: 5, requirement: "Original school ID" },
                      ],
                    },
                  ]
                : [],
          },
          current_step_index: state.stepId === 91 ? 0 : 1,
          current_step_requires_academic: false,
          event_completed: state.eventComplete,
          active_ticket: state.eventActive,
        });
      case "public_live_queue.php":
        return ok({
          generated_at: "2026-10-30 10:03:00",
          you: { office_id: 1, window_id: 1, queue_number: "REG-007" },
          offices: [
            {
              id: 1,
              name: "Registrar",
              windows: [
                {
                  id: 1,
                  name: "Window 1",
                  status: "open",
                  is_paused: false,
                  queue_type: "both",
                  current: { queue_number: "REG-004", type: "walkin" },
                  next: {
                    queue_number: "REG-005",
                    eta_label: "About 4 minutes",
                  },
                  waiting: [
                    {
                      queue_number: "REG-007",
                      type: "walkin",
                      eta_label: "About 12 minutes",
                    },
                  ],
                  waiting_count: 3,
                  last: null,
                },
              ],
            },
            { id: 2, name: "Cashier", windows: [] },
          ],
        });
      case "parent_check_child.php":
        return ok({
          allowed: true,
          message: "Details match the school record.",
        });
      case "parent_add_child.php":
        return ok({ mode: "request", message: "Student approval requested." });
      case "mobile_tour.php":
        return ok({ progress: null });
      case "cancel_queue.php":
        state.ticket = {
          ...state.ticket,
          status: "cancelled",
          can_cancel: false,
        };
        return ok({ message: "Queue cancelled." });
      case "requeue_respond.php":
        state.ticket = { ...state.ticket, is_requeued: false };
        return ok({ message: "You rejoined the queue." });
      case "update_profile.php":
        state.student = { ...state.student, ...body };
        return ok({ student: state.student });
      case "update_parent_profile.php":
        state.parent = { ...state.parent, ...body };
        return ok({ user: state.parent });
      case "change_password.php":
        return ok({});
      case "get_csm_context.php":
        return ok({
          transaction: {
            ticket_id: 40,
            office_name: "Registrar",
            queue_number: "REG-006",
            type: "walkin",
            created_at: "2026-10-30 10:00:00",
            service_availed: "Transcript of Records",
          },
        });
      case "submit_feedback.php":
        return ok({ message: "Feedback submitted." });
      case "register_push_token.php":
        return ok({});
      default:
        return ok({});
    }
  };
  return state;
};
