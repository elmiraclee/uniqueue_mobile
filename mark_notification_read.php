<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type");

require_once "db.php";

/*
|--------------------------------------------------------------------------
| MARK NOTIFICATIONS AS READ
|--------------------------------------------------------------------------
| Body: { "student_id": 5, "notification_id": 12 }   -> marks just that one
| Body: { "student_id": 5 }                          -> marks ALL of theirs
*/

$data = json_decode(file_get_contents("php://input"), true);

$student_id = intval($data["student_id"] ?? 0);
$notification_id = isset($data["notification_id"]) ? intval($data["notification_id"]) : null;

if ($student_id <= 0) {
    echo json_encode([
        "success" => false,
        "message" => "student_id is required."
    ]);
    exit;
}

if ($notification_id) {

    $sql = "
    UPDATE notifications
    SET read_at = NOW()
    WHERE id = ? AND student_id = ? AND read_at IS NULL
    ";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("ii", $notification_id, $student_id);

} else {

    $sql = "
    UPDATE notifications
    SET read_at = NOW()
    WHERE student_id = ? AND read_at IS NULL
    ";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("i", $student_id);
}

$stmt->execute();

echo json_encode([
    "success"      => true,
    "updated_rows" => $stmt->affected_rows,
]);

$conn->close();