<?php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type");

include "db.php";

// PHP 8.1+ makes mysqli throw an exception on SQL errors by default
// (MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT) instead of returning
// false. Without this try/catch, any SQL error (bad table/column name,
// etc.) fatals with an HTML error page, which breaks response.json()
// on the client and shows a generic "Unable to join queue" instead of
// the real reason.
try {

$data = json_decode(file_get_contents("php://input"), true);

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


// =====================================================
// APPOINTMENT SLIP CONFIRMATION
// Appointment holders are verified via their physical Appointment Slip
// (not a date picked here), so this is the one mandatory requirement
// for that type — re-checked server-side.
// =====================================================

if ($type === 'appointment' && !$appointment_slip_confirmed) {
    echo json_encode([
        "success" => false,
        "message" => "Please confirm you have your Appointment Slip."
    ]);
    exit;
}


// =====================================================
// PRIORITY LANE
// Re-verify against this office's own config server-side (mirrors the
// appointment_slip_confirmed check above) — a disabled option could
// still be submitted directly.
// =====================================================

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


// =====================================================
// NORMALIZE SERVICE ITEMS
// Accepts either [{service_item_id, quantity}] (current) or a flat array
// of ids (legacy), defaulting quantity to 1.
// =====================================================

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
// Sequential per office, per day, per lane (priority vs regular) so
// each lane has its own numbering — e.g. P-001, N-014.
// =====================================================

$priorityFlagInt = $priority ? 1 : 0;

$countSql = "SELECT COUNT(*) AS total
             FROM queue_tickets
             WHERE office_id = '$office_id'
             AND priority = '$priorityFlagInt'
             AND DATE(created_at) = CURDATE()";
$countResult = mysqli_query($conn, $countSql);
$countRow = $countResult ? mysqli_fetch_assoc($countResult) : ['total' => 0];
$nextSeq = intval($countRow['total']) + 1;

$queueNumber = ($priority ? 'P-' : 'N-') . str_pad($nextSeq, 3, '0', STR_PAD_LEFT);


// =====================================================
// WINDOW ASSIGNMENT
// Real schema: the table is `windows` (status enum open/closed,
// queue_type enum walkin/appointment/both), and window_item maps
// which service_items each window can actually handle. A window only
// qualifies if it's open, accepts this ticket's type, and can handle
// every requested service item. Among qualifying windows, pick the one
// with the fewest currently unresolved tickets (waiting/called/
// in_progress) assigned to it.
// =====================================================

$serviceItemIds = array_values(array_unique(array_column($normalizedServiceItems, 'service_item_id')));
$serviceItemIdsList = implode(',', $serviceItemIds);
$serviceItemCount = count($serviceItemIds);

$windowSql = "SELECT w.id, w.name,
                (SELECT COUNT(*) FROM queue_tickets qt
                 WHERE qt.window_id = w.id
                 AND qt.status IN ('waiting', 'called', 'in_progress')) AS load_count
              FROM windows w
              WHERE w.office_id = '$office_id'
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

// Fallback: no window is set up to handle this exact combination of
// service_items — assign the least-loaded open window for this type
// anyway rather than leaving the ticket unassigned.
if (!$window) {
    $fallbackSql = "SELECT w.id, w.name,
                    (SELECT COUNT(*) FROM queue_tickets qt
                     WHERE qt.window_id = w.id
                     AND qt.status IN ('waiting', 'called', 'in_progress')) AS load_count
                  FROM windows w
                  WHERE w.office_id = '$office_id'
                  AND w.status = 'open'
                  AND (w.queue_type = 'both' OR w.queue_type = '$type')
                  ORDER BY load_count ASC, w.id ASC
                  LIMIT 1";
    $fallbackResult = mysqli_query($conn, $fallbackSql);
    $window = $fallbackResult ? mysqli_fetch_assoc($fallbackResult) : null;
}

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
    // Surfaces the real cause (e.g. "Table 'office_windows' doesn't
    // exist" or "Unknown column 'queue_number'") instead of a blank/HTML
    // fatal-error response that the app can't parse as JSON.
    echo json_encode([
        "success" => false,
        "message" => "Server error: " . $e->getMessage()
    ]);
}