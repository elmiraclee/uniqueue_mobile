<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type");

require_once "db.php";

/*
|--------------------------------------------------------------------------
| CHECK & GENERATE NOTIFICATIONS
|--------------------------------------------------------------------------
| Polled by the app every few seconds (see use-notification.tsx).
| Looks at the student's most recent queue ticket:
|
|   position_update -> the number of people still ahead of the ticket
|                       changed since the last time we checked (fires on
|                       EVERY change, e.g. 5 ahead -> 4 ahead -> 3 ahead...)
|   next_in_line     -> people ahead just reached 0 (still 'waiting')
|   called           -> status just became 'called'
|   in_progress      -> status just became 'in_progress' (now serving)
|   completed        -> status just became 'completed'
|   cancelled        -> status just became 'cancelled'
|
| Position changes are tracked via queue_tickets.last_notified_position
| (see notifications_migration_v3.sql) so we only insert a new row when
| the position actually differs from the last one we notified about.
| The one-time status events (called/in_progress/completed/cancelled)
| are deduped with a simple "does this row already exist" check.
|--------------------------------------------------------------------------
*/

$data = json_decode(file_get_contents("php://input"), true);
$student_id = intval($data["student_id"] ?? 0);

if ($student_id <= 0) {
    echo json_encode([
        "success" => false,
        "message" => "student_id is required."
    ]);
    exit;
}

function statusNotificationExists($conn, $ticketId, $type) {
    $sql = "SELECT id FROM notifications WHERE ticket_id = ? AND type = ? LIMIT 1";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("is", $ticketId, $type);
    $stmt->execute();
    return $stmt->get_result()->num_rows > 0;
}

function insertNotification($conn, $student_id, $ticketId, $type, $title, $message) {
    $sql = "
    INSERT INTO notifications (student_id, ticket_id, type, title, message)
    VALUES (?, ?, ?, ?, ?)
    ";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("iisss", $student_id, $ticketId, $type, $title, $message);
    $stmt->execute();
}

/*
|--------------------------------------------------------------------------
| 1. LOOK AT THE STUDENT'S MOST RECENT TICKET
|--------------------------------------------------------------------------
*/

$sql = "
SELECT
    qt.id,
    qt.window_id,
    qt.queue_number,
    qt.status,
    qt.joined_at,
    qt.last_notified_position
FROM queue_tickets qt
WHERE qt.student_id = ?
ORDER BY qt.id DESC
LIMIT 1
";

$stmt = $conn->prepare($sql);

if (!$stmt) {
    echo json_encode(["success" => false, "message" => $conn->error]);
    exit;
}

$stmt->bind_param("i", $student_id);
$stmt->execute();
$ticket = $stmt->get_result()->fetch_assoc();

if ($ticket) {

    $ticketId = intval($ticket["id"]);
    $status   = $ticket["status"];

    if ($status === "waiting" && $ticket["window_id"]) {

        // How many people are still ahead of this ticket right now?
        $sqlAhead = "
        SELECT COUNT(*) AS total
        FROM queue_tickets
        WHERE window_id = ?
        AND status = 'waiting'
        AND joined_at < ?
        ";
        $stmtAhead = $conn->prepare($sqlAhead);
        $stmtAhead->bind_param("is", $ticket["window_id"], $ticket["joined_at"]);
        $stmtAhead->execute();
        $peopleAhead = intval($stmtAhead->get_result()->fetch_assoc()["total"]);

        $lastNotified = $ticket["last_notified_position"];
        $lastNotified = $lastNotified === null ? null : intval($lastNotified);

        // Only notify when the position actually changed since last time
        if ($lastNotified === null || $peopleAhead !== $lastNotified) {

            if ($peopleAhead === 0) {
                $type    = "next_in_line";
                $title   = "You're next in line!";
                $message = "Please get ready — you're next to be called.";
            } elseif ($peopleAhead === 1) {
                $type    = "position_update";
                $title   = "1 person ahead of you";
                $message = "You're almost there.";
            } elseif ($peopleAhead === 2) {
                $type    = "position_update";
                $title   = "2 people ahead of you";
                $message = "Almost there — 2 more to go.";
            } elseif ($peopleAhead === 3) {
                $type    = "position_update";
                $title   = "3 people ahead of you";
                $message = "You're getting close — 3 more to go.";
            } else {
                $type    = "position_update";
                $title   = "{$peopleAhead} people ahead of you";
                $message = "Please wait a little longer.";
            }

            insertNotification($conn, $student_id, $ticketId, $type, $title, $message);

            $sqlUpdate = "UPDATE queue_tickets SET last_notified_position = ? WHERE id = ?";
            $stmtUpdate = $conn->prepare($sqlUpdate);
            $stmtUpdate->bind_param("ii", $peopleAhead, $ticketId);
            $stmtUpdate->execute();
        }

    } elseif (in_array($status, ["called", "in_progress", "completed", "cancelled"], true)) {

        // One-time events — only insert if we haven't already recorded this one
        if (!statusNotificationExists($conn, $ticketId, $status)) {

            $labels = [
                "called"      => ["title" => "You've been called",   "message" => "Please proceed to the window."],
                "in_progress" => ["title" => "Now serving you",      "message" => "You are currently being served."],
                "completed"   => ["title" => "Transaction complete", "message" => "Your transaction has been completed."],
                "cancelled"   => ["title" => "Queue cancelled",      "message" => "Your queue ticket was cancelled."],
            ];

            $label = $labels[$status];
            insertNotification($conn, $student_id, $ticketId, $status, $label["title"], $label["message"]);
        }
    }
}

/*
|--------------------------------------------------------------------------
| 2. RETURN THE STUDENT'S NOTIFICATIONS
|--------------------------------------------------------------------------
*/

$sql = "
SELECT
    n.id,
    n.ticket_id,
    n.type,
    n.title,
    n.message,
    n.read_at,
    n.created_at,
    qt.queue_number,
    o.name AS office_name,
    w.name AS window_name
FROM notifications n
INNER JOIN queue_tickets qt ON qt.id = n.ticket_id
LEFT JOIN offices o ON o.id = qt.office_id
LEFT JOIN windows w ON w.id = qt.window_id
WHERE n.student_id = ?
ORDER BY n.created_at DESC
LIMIT 30
";

$stmt = $conn->prepare($sql);
$stmt->bind_param("i", $student_id);
$stmt->execute();
$result = $stmt->get_result();

$notifications = [];
$unreadCount = 0;

while ($row = $result->fetch_assoc()) {

    $isUnread = $row["read_at"] === null;
    if ($isUnread) {
        $unreadCount++;
    }

    $notifications[] = [
        "id"           => intval($row["id"]),
        "ticket_id"    => intval($row["ticket_id"]),
        "type"         => $row["type"],
        "title"        => $row["title"],
        "message"      => $row["message"],
        "queue_number" => $row["queue_number"],
        "office_name"  => $row["office_name"],
        "window_name"  => $row["window_name"],
        "is_read"      => !$isUnread,
        "created_at"   => $row["created_at"],
    ];
}

echo json_encode([
    "success"       => true,
    "unread_count"  => $unreadCount,
    "notifications" => $notifications,
], JSON_UNESCAPED_UNICODE);

$conn->close();