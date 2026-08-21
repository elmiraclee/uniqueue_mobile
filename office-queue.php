<?php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST");
header("Access-Control-Allow-Headers: Content-Type");

include "db.php";

try {

// =====================================================
function findBestWindow($conn, $officeId, $serviceItemIds, $type) {

    $officeId = intval($officeId);
    $type = mysqli_real_escape_string($conn, $type);
    $window = null;

    $serviceItemIds = array_values(array_unique(array_map('intval', $serviceItemIds ?? [])));

    if (!empty($serviceItemIds)) {
        $serviceItemIdsList = implode(',', $serviceItemIds);
        $serviceItemCount = count($serviceItemIds);

        $windowSql = "SELECT w.id, w.name,
                        (SELECT COUNT(*) FROM queue_tickets qt
                         WHERE qt.window_id = w.id
                         AND qt.status IN ('waiting', 'called', 'in_progress')) AS load_count
                      FROM windows w
                      WHERE w.office_id = '$officeId'
                      AND w.status = 'open'
                      AND (w.queue_type = 'both' OR w.queue_type = '$type')
                      AND (
                        SELECT COUNT(DISTINCT wd.service_item_id)
                        FROM window_item wd
                        WHERE wd.window_id = w.id
                        AND wd.service_item_id IN ($serviceItemIdsList)
                      ) = $serviceItemCount
                      ORDER BY load_count ASC, w.id ASC
                      LIMIT 1";
        $windowResult = mysqli_query($conn, $windowSql);
        $window = $windowResult ? mysqli_fetch_assoc($windowResult) : null;
    }

    if (!$window) {
        $fallbackSql = "SELECT w.id, w.name,
                        (SELECT COUNT(*) FROM queue_tickets qt
                         WHERE qt.window_id = w.id
                         AND qt.status IN ('waiting', 'called', 'in_progress')) AS load_count
                      FROM windows w
                      WHERE w.office_id = '$officeId'
                      AND w.status = 'open'
                      AND (w.queue_type = 'both' OR w.queue_type = '$type')
                      ORDER BY load_count ASC, w.id ASC
                      LIMIT 1";
        $fallbackResult = mysqli_query($conn, $fallbackSql);
        $window = $fallbackResult ? mysqli_fetch_assoc($fallbackResult) : null;
    }

    return $window; // ['id'=>.., 'name'=>.., 'load_count'=>..] or null
}


function get_office_queue_prefix($conn, $officeId) {

    static $prefixMap = null;

    if ($prefixMap === null) {

        $prefixMap = [];
        $used = [];

        $officesResult = mysqli_query($conn, "SELECT id, name FROM offices WHERE is_active = 1 ORDER BY id ASC");

        while ($o = mysqli_fetch_assoc($officesResult)) {

            $words  = preg_split('/\s+/', trim($o['name']));
            $letter = null;

            // Try the first letter of each word in the office name first
            // (e.g. "Student Affairs" -> S, then A if S is taken).
            foreach ($words as $word) {
                $candidate = strtoupper(substr($word, 0, 1));
                if ($candidate !== '' && !isset($used[$candidate])) {
                    $letter = $candidate;
                    break;
                }
            }

            // All single letters from the name are taken — extend to a
            // longer prefix (RE, REG, ...) built from the letters of the
            // name until it's unique.
            if ($letter === null) {

                $base = strtoupper(preg_replace('/[^A-Za-z]/', '', $o['name']));
                $len  = 2;

                do {
                    $candidate = substr($base, 0, $len);
                    $len++;
                } while ($candidate !== '' && isset($used[$candidate]) && $len <= strlen($base) + 1);

                $letter = $candidate !== '' ? $candidate : 'OFC';

                // Still colliding (e.g. two offices with identical names) —
                // guarantee uniqueness with the office id as a last resort.
                if (isset($used[$letter])) {
                    $letter .= $o['id'];
                }
            }

            $used[$letter]      = true;
            $prefixMap[$o['id']] = $letter;
        }
    }

    return $prefixMap[$officeId] ?? 'Q';
}

function nextQueueNumber($conn, $officeId) {

    $officeId = intval($officeId);

    $countSql = "SELECT COUNT(*) AS total
                 FROM queue_tickets
                 WHERE office_id = '$officeId'
                 AND DATE(created_at) = CURDATE()";
    $countResult = mysqli_query($conn, $countSql);
    $countRow = $countResult ? mysqli_fetch_assoc($countResult) : ['total' => 0];
    $nextSeq = intval($countRow['total']) + 1;

    $prefix = get_office_queue_prefix($conn, $officeId);

    return $prefix . '-' . str_pad($nextSeq, 3, '0', STR_PAD_LEFT);
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {

    $action = $_GET['action'] ?? '';

    if ($action === 'events') {

        $sql = "SELECT e.id, e.office_id, e.name, e.description,
                       e.start_date, e.end_date, o.slug AS office_slug
                FROM events e
                JOIN offices o ON o.id = e.office_id
                WHERE e.status = 'active'
                AND o.is_active = 1
                AND (e.start_date IS NULL OR CURDATE() BETWEEN e.start_date AND e.end_date)
                ORDER BY e.created_at DESC";
        $result = mysqli_query($conn, $sql);
        $events = $result ? mysqli_fetch_all($result, MYSQLI_ASSOC) : [];

        echo json_encode(["success" => true, "events" => $events]);
        exit;
    }

    if ($action === 'event') {

        $eventId = intval($_GET['event_id'] ?? 0);
        $officeId = intval($_GET['office_id'] ?? 0);
        $studentId = intval($_GET['student_id'] ?? 0);

        if (!$eventId || !$officeId) {
            echo json_encode(["success" => false, "message" => "Missing event or office."]);
            exit;
        }

        $evResult = mysqli_query($conn, "
            SELECT * FROM events
            WHERE id = '$eventId' AND office_id = '$officeId' AND status = 'active'
            AND (start_date IS NULL OR CURDATE() BETWEEN start_date AND end_date)
            LIMIT 1
        ");
        $event = $evResult ? mysqli_fetch_assoc($evResult) : null;

        if (!$event) {
            echo json_encode(["success" => false, "message" => "This event is not available."]);
            exit;
        }

        $stepsResult = mysqli_query($conn, "
            SELECT es.id, es.step_order, es.title, es.description, es.office_id,
                   o.name AS office_name, o.slug AS office_slug
            FROM event_steps es
            LEFT JOIN offices o ON o.id = es.office_id
            WHERE es.event_id = '$eventId'
            ORDER BY es.step_order ASC, es.id ASC
        ");
        $steps = $stepsResult ? mysqli_fetch_all($stepsResult, MYSQLI_ASSOC) : [];

        if ($steps) {
            $stepIdsList = implode(',', array_map('intval', array_column($steps, 'id')));

            $esdResult = mysqli_query($conn, "
                SELECT esd.event_step_id, esd.service_item_id, esd.quantity, d.name
                FROM event_step_items esd
                INNER JOIN service_items d ON d.id = esd.service_item_id
                WHERE esd.event_step_id IN ($stepIdsList)
            ");
            $esdRows = $esdResult ? mysqli_fetch_all($esdResult, MYSQLI_ASSOC) : [];

            $docIds = array_values(array_unique(array_map('intval', array_column($esdRows, 'service_item_id'))));
            $requirementsBySvc = [];
            if ($docIds) {
                $docIdsList = implode(',', $docIds);
                $reqResult = mysqli_query($conn, "
                    SELECT id, service_item_id, requirement
                    FROM service_item_requirements
                    WHERE service_item_id IN ($docIdsList)
                    ORDER BY id ASC
                ");
                $reqRows = $reqResult ? mysqli_fetch_all($reqResult, MYSQLI_ASSOC) : [];
                foreach ($reqRows as $row) {
                    $requirementsBySvc[$row['service_item_id']][] = $row;
                }
            }

            $docsByStep = [];
            foreach ($esdRows as $row) {
                $row['requirements'] = $requirementsBySvc[$row['service_item_id']] ?? [];
                $docsByStep[$row['event_step_id']][] = $row;
            }

            foreach ($steps as &$s) {
                $s['service_items'] = $docsByStep[$s['id']] ?? [];
            }
            unset($s);
        }

        $currentStep = null;
        $currentStepIndex = null;
        $completedStepIds = [];

        if ($studentId) {

            $doneResult = mysqli_query($conn, "
                SELECT event_step_id FROM queue_tickets
                WHERE student_id = '$studentId' AND event_id = '$eventId'
                AND status = 'completed'
            ");
            $doneRows = $doneResult ? mysqli_fetch_all($doneResult, MYSQLI_ASSOC) : [];
            $completedStepIds = array_map('intval', array_column($doneRows, 'event_step_id'));
        }

        foreach ($steps as $i => $s) {
            if (!in_array((int)$s['id'], $completedStepIds, true)) {
                $currentStep = $s;
                $currentStepIndex = $i;
                break;
            }
        }

        $eventCompleted = ($currentStep === null && !empty($steps));

        $activeTicket = null;
        if ($studentId) {
            $activeResult = mysqli_query($conn, "
                SELECT qt.id, qt.queue_number, qt.status, qt.event_step_id, w.name AS window_name
                FROM queue_tickets qt
                LEFT JOIN windows w ON w.id = qt.window_id
                WHERE qt.student_id = '$studentId' AND qt.event_id = '$eventId'
                AND qt.status IN ('waiting', 'called', 'in_progress')
                ORDER BY qt.created_at DESC
                LIMIT 1
            ");
            $activeTicket = $activeResult ? mysqli_fetch_assoc($activeResult) : null;
        }

        echo json_encode([
            "success" => true,
            "event" => $event,
            "steps" => $steps,
            "current_step" => $currentStep,
            "current_step_index" => $currentStepIndex,
            "event_completed" => $eventCompleted,
            "active_ticket" => $activeTicket,
        ]);
        exit;
    }

    // =================================================
    // GET action=cashier_payable
    // Returns all completed tickets from other offices
    // that haven't been paid at the cashier yet.
    // Used by the mobile cashier queue screen to show
    // the student what they can pay for.
    //
    // Required params:
    //   student_id — the logged-in student
    //   office_id  — the cashier office id
    // =================================================
    if ($action === 'cashier_payable') {

        $studentId = intval($_GET['student_id'] ?? 0);
        $cashierOfficeId = intval($_GET['office_id'] ?? 0);

        if (!$studentId || !$cashierOfficeId) {
            echo json_encode(["success" => false, "message" => "Missing student_id or office_id."]);
            exit;
        }

        // Verify this office is actually the cashier office
        $officeCheck = mysqli_query($conn, "
            SELECT id FROM offices
            WHERE id = '$cashierOfficeId' AND is_active = 1
            LIMIT 1
        ");
        if (!$officeCheck || mysqli_num_rows($officeCheck) === 0) {
            echo json_encode(["success" => false, "message" => "Office not found."]);
            exit;
        }

        // Fetch completed tickets from other offices that have
        // at least one service item with an amount, and have
        // not yet been linked to a cashier ticket (paid).
        $payStmt = mysqli_prepare($conn, "
            SELECT
                qt.id               AS ticket_id,
                qt.queue_number,
                qt.done_at,
                o.id                AS source_office_id,
                o.name              AS source_office_name,
                d.id                AS service_item_id,
                d.name              AS service_item_name,
                d.amount,
                qtd.quantity
            FROM queue_tickets qt
            JOIN offices o              ON o.id = qt.office_id
            JOIN queue_ticket_item qtd  ON qtd.ticket_id = qt.id
            JOIN service_items d        ON d.id = qtd.service_item_id
            LEFT JOIN queue_tickets paid
                ON paid.linked_ticket_id = qt.id
               AND paid.status != 'cancelled'
            WHERE qt.student_id = ?
              AND qt.office_id  != ?
              AND qt.status      = 'completed'
              AND d.amount       > 0
              AND paid.id IS NULL
            ORDER BY qt.done_at DESC
        ");
        mysqli_stmt_bind_param($payStmt, "ii", $studentId, $cashierOfficeId);
        mysqli_stmt_execute($payStmt);
        $payResult = mysqli_stmt_get_result($payStmt);
        $payRows = $payResult ? mysqli_fetch_all($payResult, MYSQLI_ASSOC) : [];

        // Group rows by originating ticket — one ticket can
        // carry several service items, each as its own row.
        $grouped = [];
        foreach ($payRows as $row) {
            $tid = $row['ticket_id'];
            if (!isset($grouped[$tid])) {
                $grouped[$tid] = [
                    'ticket_id'          => intval($tid),
                    'queue_number'       => $row['queue_number'],
                    'done_at'            => $row['done_at'],
                    'source_office_id'   => intval($row['source_office_id']),
                    'source_office_name' => $row['source_office_name'],
                    'service_items'      => [],
                    'total'              => 0.0,
                ];
            }
            $grouped[$tid]['service_items'][] = [
                'id'       => intval($row['service_item_id']),
                'name'     => $row['service_item_name'],
                'amount'   => (float) $row['amount'],
                'quantity' => intval($row['quantity']),
                'subtotal' => (float) $row['amount'] * intval($row['quantity']),
            ];
            $grouped[$tid]['total'] += (float) $row['amount'] * intval($row['quantity']);
        }

        $payable = array_values($grouped);

        // Round totals to 2 decimal places for clean JSON
        foreach ($payable as &$pt) {
            $pt['total'] = round($pt['total'], 2);
            foreach ($pt['service_items'] as &$svc) {
                $svc['amount']   = round($svc['amount'], 2);
                $svc['subtotal'] = round($svc['subtotal'], 2);
            }
            unset($svc);
        }
        unset($pt);

        echo json_encode([
            "success"  => true,
            "payable"  => $payable,
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    echo json_encode(["success" => false, "message" => "Unknown action."]);
    exit;
}


// =====================================================
// POST
// =====================================================

$data = json_decode(file_get_contents("php://input"), true);
$mode = $data['mode'] ?? 'regular';

// =====================================================
// POST mode=cashier
// Student joins the cashier queue to pay for a
// completed ticket from another office.
// Body: { student_id, office_id, source_ticket_id }
// =====================================================
if ($mode === 'cashier') {

    $student_id       = intval($data['student_id'] ?? 0);
    $cashier_office_id = intval($data['office_id'] ?? 0);
    $source_ticket_id  = intval($data['source_ticket_id'] ?? 0);
    $priority          = !empty($data['priority']) ? 1 : 0;
    $priority_reason   = trim($data['priority_reason'] ?? '');

    if (!$student_id || !$cashier_office_id || !$source_ticket_id) {
        echo json_encode(["success" => false, "message" => "Missing required fields."]);
        exit;
    }

    // Server-side priority validation — mirrors the client guard.
    $priorityReasonEscaped = mysqli_real_escape_string($conn, $priority_reason);
    if ($priority && $priority_reason === '') {
        echo json_encode(["success" => false, "message" => "Please enter a reason for priority lane."]);
        exit;
    }

    // Capacity check
    $capResult = mysqli_query($conn, "
        SELECT oc.daily_capacity,
               (SELECT COUNT(*) FROM queue_tickets
                WHERE office_id = '$cashier_office_id'
                  AND status != 'cancelled'
                  AND DATE(created_at) = CURDATE()) AS today_count
        FROM office_configs oc
        WHERE oc.office_id = '$cashier_office_id'
        LIMIT 1
    ");
    $capRow = $capResult ? mysqli_fetch_assoc($capResult) : null;
    if ($capRow && $capRow['daily_capacity'] !== null
        && intval($capRow['today_count']) >= intval($capRow['daily_capacity'])) {
        echo json_encode(["success" => false, "message" => "This office has reached its full capacity for today. Please try again tomorrow."]);
        exit;
    }

    // Re-verify server-side: must be the student's own completed ticket
    // at a DIFFERENT office, not yet paid (no non-cancelled cashier ticket
    // linked to it). Never trust the client.
    $verifyStmt = mysqli_prepare($conn, "
        SELECT qt.id, qt.office_id
        FROM queue_tickets qt
        LEFT JOIN queue_tickets paid
            ON paid.linked_ticket_id = qt.id
           AND paid.status != 'cancelled'
        WHERE qt.id         = ?
          AND qt.student_id = ?
          AND qt.office_id != ?
          AND qt.status     = 'completed'
          AND paid.id IS NULL
        LIMIT 1
    ");
    mysqli_stmt_bind_param($verifyStmt, "iii", $source_ticket_id, $student_id, $cashier_office_id);
    mysqli_stmt_execute($verifyStmt);
    $verifyResult = mysqli_stmt_get_result($verifyStmt);
    $sourceTicket = $verifyResult ? mysqli_fetch_assoc($verifyResult) : null;

    if (!$sourceTicket) {
        echo json_encode(["success" => false, "message" => "That request is no longer available for payment."]);
        exit;
    }

    // Copy service items from the source ticket onto the new cashier
    // ticket so staff see exactly what's being paid for + amount.
    $srcSvcResult = mysqli_query($conn, "
        SELECT service_item_id, quantity FROM queue_ticket_item WHERE ticket_id = '$source_ticket_id'
    ");
    $srcSvcItems = $srcSvcResult ? mysqli_fetch_all($srcSvcResult, MYSQLI_ASSOC) : [];

    // Cashier windows aren't scoped to specific service items —
    // any open walk-in window can accept payment.
    $windowResult = mysqli_query($conn, "
        SELECT id, name,
               (SELECT COUNT(*) FROM queue_tickets qt
                WHERE qt.window_id = w.id
                  AND qt.status IN ('waiting','called','in_progress')) AS load_count
        FROM windows w
        WHERE w.office_id = '$cashier_office_id'
          AND w.status    = 'open'
          AND (w.queue_type = 'walkin' OR w.queue_type = 'both')
        ORDER BY load_count ASC, w.id ASC
        LIMIT 1
    ");
    $window = $windowResult ? mysqli_fetch_assoc($windowResult) : null;
    $windowId   = $window ? intval($window['id']) : null;
    $windowName = $window ? $window['name'] : 'Not Assigned';

    $queueNumber  = nextQueueNumber($conn, $cashier_office_id);
    $windowIdSql  = $windowId !== null ? "'$windowId'" : "NULL";

    $insertSql = "INSERT INTO queue_tickets
                    (student_id, office_id, linked_ticket_id, queue_number, type, status,
                     priority, priority_reason, window_id, created_at, updated_at)
                  VALUES
                    ('$student_id', '$cashier_office_id', '$source_ticket_id',
                     '$queueNumber', 'walkin', 'waiting', '$priority',
                     " . ($priorityReasonEscaped !== '' ? "'$priorityReasonEscaped'" : "NULL") . ",
                     $windowIdSql, NOW(), NOW())";

    if (!mysqli_query($conn, $insertSql)) {
        echo json_encode(["success" => false, "message" => mysqli_error($conn)]);
        exit;
    }

    $ticketId = mysqli_insert_id($conn);

    foreach ($srcSvcItems as $svc) {
        $svcId  = intval($svc['service_item_id']);
        $svcQty = intval($svc['quantity']);
        mysqli_query($conn, "INSERT INTO queue_ticket_item (ticket_id, service_item_id, quantity)
                             VALUES ('$ticketId', '$svcId', '$svcQty')");
    }

    echo json_encode([
        "success"      => true,
        "message"      => "You have joined the payment queue.",
        "queue_number" => $queueNumber,
        "window_name"  => $windowName,
    ]);
    exit;
}

if ($mode === 'event') {

    $student_id = intval($data['student_id'] ?? 0);
    $event_id = intval($data['event_id'] ?? 0);
    $event_step_id = intval($data['event_step_id'] ?? 0);
    $priority = !empty($data['priority']);
    $priority_reason = trim($data['priority_reason'] ?? '');
    $checked_requirement_ids = array_map('intval', $data['req_check'] ?? []);

    if (!$student_id || !$event_id || !$event_step_id) {
        echo json_encode(["success" => false, "message" => "Missing required fields."]);
        exit;
    }

    $evResult = mysqli_query($conn, "
        SELECT * FROM events
        WHERE id = '$event_id' AND status = 'active'
        AND (start_date IS NULL OR CURDATE() BETWEEN start_date AND end_date)
        LIMIT 1
    ");
    $event = $evResult ? mysqli_fetch_assoc($evResult) : null;

    if (!$event) {
        echo json_encode(["success" => false, "message" => "This event is no longer available."]);
        exit;
    }

    $stepsResult = mysqli_query($conn, "
        SELECT es.id, es.step_order, es.title, es.office_id
        FROM event_steps es
        WHERE es.event_id = '$event_id'
        ORDER BY es.step_order ASC, es.id ASC
    ");
    $steps = $stepsResult ? mysqli_fetch_all($stepsResult, MYSQLI_ASSOC) : [];

    // Same note as the GET branch above: only 'completed' is a real
    // status value for this column.
    $doneResult = mysqli_query($conn, "
        SELECT event_step_id FROM queue_tickets
        WHERE student_id = '$student_id' AND event_id = '$event_id'
        AND status = 'completed'
    ");
    $doneRows = $doneResult ? mysqli_fetch_all($doneResult, MYSQLI_ASSOC) : [];
    $completedStepIds = array_map('intval', array_column($doneRows, 'event_step_id'));

    $currentStep = null;
    foreach ($steps as $s) {
        if (!in_array((int)$s['id'], $completedStepIds, true)) {
            $currentStep = $s;
            break;
        }
    }

    if (!$currentStep || (int)$currentStep['id'] !== $event_step_id) {
        echo json_encode(["success" => false, "message" => "That step is not currently available for you to join."]);
        exit;
    }

    $stepDocsResult = mysqli_query($conn, "
        SELECT service_item_id, quantity FROM event_step_items WHERE event_step_id = '$event_step_id'
    ");
    $stepDocs = $stepDocsResult ? mysqli_fetch_all($stepDocsResult, MYSQLI_ASSOC) : [];
    $stepDocIds = array_map('intval', array_column($stepDocs, 'service_item_id'));

    if ($stepDocIds) {
        $docIdsList = implode(',', $stepDocIds);
        $reqResult = mysqli_query($conn, "SELECT id FROM service_item_requirements WHERE service_item_id IN ($docIdsList)");
        $reqRows = $reqResult ? mysqli_fetch_all($reqResult, MYSQLI_ASSOC) : [];
        $requiredIds = array_map('intval', array_column($reqRows, 'id'));

        $missing = array_diff($requiredIds, $checked_requirement_ids);
        if ($missing) {
            echo json_encode(["success" => false, "message" => "Please confirm all requirements are met before joining the queue."]);
            exit;
        }
    }

    $activeResult = mysqli_query($conn, "
        SELECT id FROM queue_tickets
        WHERE student_id = '$student_id' AND status IN ('waiting','called','in_progress')
        LIMIT 1
    ");
    $activeRow = $activeResult ? mysqli_fetch_assoc($activeResult) : null;
    if ($activeRow) {
        echo json_encode(["success" => false, "message" => "You already have an active queue. Finish or cancel it first."]);
        exit;
    }

    $step_office_id = intval($currentStep['office_id']);
    $priority_reason_escaped = mysqli_real_escape_string($conn, $priority_reason);

    $window = findBestWindow($conn, $step_office_id, $stepDocIds, 'walkin');
    if (!$window) {
        echo json_encode(["success" => false, "message" => "No window currently handles this step. Please contact the office."]);
        exit;
    }
    $windowId = intval($window['id']);
    $windowName = $window['name'];

    $priorityFlagInt = $priority ? 1 : 0;
    $queueNumber = nextQueueNumber($conn, $step_office_id);

    $eventStepTitle = empty($stepDocs) ? $currentStep['title'] : null;
    $eventStepTitleSql = $eventStepTitle !== null
        ? "'" . mysqli_real_escape_string($conn, $eventStepTitle) . "'"
        : "NULL";

    $sql = "INSERT INTO queue_tickets(
                student_id, office_id, event_id, event_step_id, event_step_title, type,
                queue_number, status, priority, priority_reason,
                window_id, created_at, updated_at
            )
            VALUES(
                '$student_id', '$step_office_id', '$event_id', '$event_step_id', $eventStepTitleSql, 'walkin',
                '$queueNumber', 'waiting', '$priorityFlagInt',
                " . ($priority_reason_escaped !== '' ? "'$priority_reason_escaped'" : "NULL") . ",
                '$windowId', NOW(), NOW()
            )";

    if (mysqli_query($conn, $sql)) {

        $ticketId = mysqli_insert_id($conn);

        foreach ($stepDocs as $sd) {
            $docId = intval($sd['service_item_id']);
            $qty = max(1, intval($sd['quantity']));
            mysqli_query($conn, "
                INSERT INTO queue_ticket_item(ticket_id, service_item_id, quantity)
                VALUES('$ticketId', '$docId', '$qty')
            ");
        }

        echo json_encode([
            "success" => true,
            "message" => "You have joined the queue.",
            "queue_number" => $queueNumber,
            "window_name" => $windowName,
            "step_title" => $currentStep['title'],
        ]);

    } else {
        echo json_encode(["success" => false, "message" => mysqli_error($conn)]);
    }

    exit;
}


$student_id = $data['student_id'] ?? null;
$office_id = $data['office_id'] ?? null;
$type = $data['type'] ?? null; // walkin or appointment
$appointment_slip_confirmed = !empty($data['appointment_slip_confirmed']);
$priority = !empty($data['priority']);
$priority_reason = trim($data['priority_reason'] ?? '');
$service_items = $data['service_items'] ?? []; // array of { service_item_id, quantity }


// =====================================================
// BASIC VALIDATION
// =====================================================

if (!$student_id || !$office_id || !$type) {
    echo json_encode([
        "success" => false,
        "message" => "Missing required fields."
    ]);
    exit;
}

if (empty($service_items)) {
    echo json_encode([
        "success" => false,
        "message" => "Please select at least one service item or service."
    ]);
    exit;
}

$student_id = intval($student_id);
$office_id = intval($office_id);
$type = mysqli_real_escape_string($conn, $type);


if ($type === 'appointment' && !$appointment_slip_confirmed) {
    echo json_encode([
        "success" => false,
        "message" => "Please confirm you have your Appointment Slip."
    ]);
    exit;
}

$configResult = mysqli_query(
    $conn,
    "SELECT priority_enabled FROM office_configs WHERE office_id = '$office_id' LIMIT 1"
);
$config = $configResult ? mysqli_fetch_assoc($configResult) : null;
$priorityEnabledForOffice = $config === null || $config['priority_enabled'] === null
    ? true
    : (bool) intval($config['priority_enabled']);

if ($priority && !$priorityEnabledForOffice) {
    $priority = false;
    $priority_reason = '';
}

if ($priority && $priority_reason === '') {
    echo json_encode([
        "success" => false,
        "message" => "Please enter a reason for priority lane."
    ]);
    exit;
}

$priority_reason_escaped = mysqli_real_escape_string($conn, $priority_reason);

$normalizedServiceItems = [];

foreach ($service_items as $svc) {
    if (is_array($svc)) {
        $serviceItemId = intval($svc['service_item_id'] ?? 0);
        $quantity = intval($svc['quantity'] ?? 1);
    } else {
        $serviceItemId = intval($svc);
        $quantity = 1;
    }

    if ($serviceItemId <= 0) {
        continue;
    }

    $normalizedServiceItems[] = [
        'service_item_id' => $serviceItemId,
        'quantity' => max(1, $quantity),
    ];
}

if (empty($normalizedServiceItems)) {
    echo json_encode([
        "success" => false,
        "message" => "Please select at least one service item or service."
    ]);
    exit;
}


// =====================================================
// QUEUE NUMBER
// =====================================================

$priorityFlagInt = $priority ? 1 : 0;
$queueNumber = nextQueueNumber($conn, $office_id);


// =====================================================
// WINDOW ASSIGNMENT
// =====================================================

$serviceItemIds = array_column($normalizedServiceItems, 'service_item_id');
$window = findBestWindow($conn, $office_id, $serviceItemIds, $type);

$windowId = $window ? intval($window['id']) : null;
$windowName = $window ? $window['name'] : 'Not Assigned';


// =====================================================
// INSERT QUEUE TICKET
// =====================================================

$windowIdSql = $windowId !== null ? "'$windowId'" : "NULL";

$sql = "INSERT INTO queue_tickets(
            student_id,
            office_id,
            type,
            queue_number,
            status,
            priority,
            priority_reason,
            window_id,
            created_at,
            updated_at
        )
        VALUES(
            '$student_id',
            '$office_id',
            '$type',
            '$queueNumber',
            'waiting',
            '$priorityFlagInt',
            " . ($priority_reason_escaped !== '' ? "'$priority_reason_escaped'" : "NULL") . ",
            $windowIdSql,
            NOW(),
            NOW()
        )";

if (mysqli_query($conn, $sql)) {

    $ticketId = mysqli_insert_id($conn);

    // =====================================================
    // SAVE SERVICE ITEMS (with quantity)
    // =====================================================

    foreach ($normalizedServiceItems as $svc) {
        mysqli_query(
            $conn,
            "INSERT INTO queue_ticket_item(
                ticket_id,
                service_item_id,
                quantity
            )
            VALUES(
                '$ticketId',
                '{$svc['service_item_id']}',
                '{$svc['quantity']}'
            )"
        );
    }

    echo json_encode([
        "success" => true,
        "message" => "You have joined the queue.",
        "queue_number" => $queueNumber,
        "window_name" => $windowName,
    ]);

} else {

    echo json_encode([
        "success" => false,
        "message" => mysqli_error($conn)
    ]);
}

} catch (\Throwable $e) {

    echo json_encode([
        "success" => false,
        "message" => "Server error: " . $e->getMessage()
    ]);
}