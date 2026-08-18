<?php

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type");

require_once("db.php");

$data = json_decode(file_get_contents("php://input"), true);

$student_id = intval($data["student_id"] ?? 0);
$queue_id   = intval($data["queue_id"] ?? 0);

if ($student_id <= 0 || $queue_id <= 0) {
    echo json_encode([
        "success" => false,
        "message" => "Invalid request."
    ]);
    exit;
}

/*
|--------------------------------------------------------------------------
| Check Queue
|--------------------------------------------------------------------------
*/

$sql = "
SELECT
    id,
    status,
    student_id

FROM queue_tickets

WHERE
id = ?
AND student_id = ?

LIMIT 1
";

$stmt = $conn->prepare($sql);
$stmt->bind_param("ii", $queue_id, $student_id);
$stmt->execute();

$result = $stmt->get_result();

if ($result->num_rows == 0) {

    echo json_encode([
        "success" => false,
        "message" => "Queue not found."
    ]);
    exit;
}

$queue = $result->fetch_assoc();

/*
|--------------------------------------------------------------------------
| Only waiting queue can be cancelled
|--------------------------------------------------------------------------
*/

if ($queue["status"] != "waiting") {

    echo json_encode([
        "success" => false,
        "message" => "This queue can no longer be cancelled."
    ]);
    exit;
}

/*
|--------------------------------------------------------------------------
| Cancel Queue
|--------------------------------------------------------------------------
*/

$update = $conn->prepare("
UPDATE queue_tickets
SET
status='cancelled',
updated_at=NOW()
WHERE id=?
");

$update->bind_param("i", $queue_id);

if ($update->execute()) {

    echo json_encode([
        "success" => true,
        "message" => "Queue cancelled successfully."
    ]);

} else {

    echo json_encode([
        "success" => false,
        "message" => "Unable to cancel queue."
    ]);

}