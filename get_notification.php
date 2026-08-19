<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type");

require_once "db.php";

/*
|--------------------------------------------------------------------------
| GET NOTIFICATIONS
|--------------------------------------------------------------------------
| Plain read - does NOT generate new notifications (that's
| check_notifications.php's job). Used when the modal opens so we don't
| need to wait on the "does anything need to be inserted" logic.
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

if (!$stmt) {
    echo json_encode(["success" => false, "message" => $conn->error]);
    exit;
}

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