<?php

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type");

require_once("db.php");

$data = json_decode(file_get_contents("php://input"), true);

$student_id = intval($data["student_id"] ?? 0);

if ($student_id <= 0) {
    echo json_encode([
        "success" => false,
        "message" => "Invalid student."
    ]);
    exit;
}

/*
|--------------------------------------------------------------------------
| Current Queue
|--------------------------------------------------------------------------
*/

$sql = "
SELECT
    qt.id,
    qt.office_id,
    qt.window_id,
    qt.queue_number,
    qt.status,
    qt.type,
    qt.joined_at,
    qt.called_at,
    qt.done_at,

    o.name AS office_name,
    w.name AS window_name

FROM queue_tickets qt

INNER JOIN offices o
    ON qt.office_id = o.id

LEFT JOIN windows w
    ON qt.window_id = w.id

WHERE
    qt.student_id = ?
AND qt.status IN ('waiting','called','in_progress')

ORDER BY qt.id DESC

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

if ($result->num_rows == 0) {
    echo json_encode([
        "success" => false,
        "message" => "No active queue."
    ]);
    exit;
}

$queue = $result->fetch_assoc();

$queue_id = intval($queue["id"]);

/*
|--------------------------------------------------------------------------
| Documents
|--------------------------------------------------------------------------
*/

$documents = [];

$docSql = "
SELECT
    d.name,
    qtd.quantity

FROM queue_ticket_document qtd

INNER JOIN documents d
    ON qtd.document_id = d.id

WHERE qtd.ticket_id = ?
";

$docStmt = $conn->prepare($docSql);

if ($docStmt) {

    $docStmt->bind_param("i", $queue_id);
    $docStmt->execute();

    $docResult = $docStmt->get_result();

    while ($row = $docResult->fetch_assoc()) {
        $documents[] = $row;
    }

    $docStmt->close();
}

$queue["documents"] = $documents;

/*
|--------------------------------------------------------------------------
| People Ahead
|--------------------------------------------------------------------------
*/

$waitingSql = "
SELECT COUNT(*) AS total

FROM queue_tickets

WHERE
office_id = ?
AND window_id = ?
AND status='waiting'
AND id < ?
";

$waitStmt = $conn->prepare($waitingSql);

if ($waitStmt) {

    $office_id = intval($queue["office_id"]);
    $window_id = intval($queue["window_id"]);

    $waitStmt->bind_param(
        "iii",
        $office_id,
        $window_id,
        $queue_id
    );

    $waitStmt->execute();

    $waiting = $waitStmt->get_result()->fetch_assoc();

    $queue["people_ahead"] = intval($waiting["total"]);

    $waitStmt->close();

} else {

    $queue["people_ahead"] = 0;

}

echo json_encode([
    "success" => true,
    "queue" => $queue
]);