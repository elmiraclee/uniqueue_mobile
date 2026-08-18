<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");

include "db.php";

$student_id = isset($_GET['student_id']) ? (int)$_GET['student_id'] : 0;

if ($student_id <= 0) {
    echo json_encode([
        "success" => false,
        "message" => "Invalid student."
    ]);
    exit;
}

/*
    "Pending feedback" = the student's most recent completed
    queue_ticket that has no matching row in `feedbacks` yet.
    The frontend uses this to block joining a new queue until
    the student rates this one.
*/
$sql = "
SELECT
    qt.id AS ticket_id,
    qt.queue_number,
    qt.type,
    qt.done_at,
    qt.created_at,
    o.name AS office_name

FROM queue_tickets qt

INNER JOIN offices o
    ON qt.office_id = o.id

LEFT JOIN feedbacks f
    ON f.ticket_id = qt.id

WHERE qt.student_id = ?
AND qt.status = 'completed'
AND f.id IS NULL

ORDER BY qt.done_at DESC, qt.created_at DESC
LIMIT 1
";

$stmt = $conn->prepare($sql);

if (!$stmt) {
    echo json_encode([
        "success" => false,
        "message" => $conn->error
    ]);
    exit;
}

$stmt->bind_param("i", $student_id);
$stmt->execute();

$result = $stmt->get_result();

if ($result->num_rows > 0) {
    echo json_encode([
        "success" => true,
        "pending" => true,
        "transaction" => $result->fetch_assoc()
    ]);
} else {
    echo json_encode([
        "success" => true,
        "pending" => false
    ]);
}

$stmt->close();
$conn->close();
?>