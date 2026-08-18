<?php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: POST");

require_once "db.php";

$data = json_decode(file_get_contents("php://input"), true);

if (!$data || !isset($data["queue_id"])) {
    echo json_encode([
        "success" => false,
        "message" => "Queue ID is required."
    ]);
    exit;
}

$queueId = intval($data["queue_id"]);

/*
|--------------------------------------------------------------------------
| LOAD CURRENT QUEUE
|--------------------------------------------------------------------------
*/

$sql = "
SELECT
    qt.id,
    qt.student_id,
    qt.office_id,
    qt.window_id,
    qt.queue_number,
    qt.status,
    qt.joined_at,

    o.name AS office_name,
    w.name AS window_name

FROM queue_tickets qt

LEFT JOIN offices o
ON o.id = qt.office_id

LEFT JOIN windows w
ON w.id = qt.window_id

WHERE qt.id = ?

LIMIT 1
";

$stmt = $conn->prepare($sql);
$stmt->bind_param("i", $queueId);
$stmt->execute();

$result = $stmt->get_result();

if ($result->num_rows == 0) {
    echo json_encode([
        "success" => false,
        "message" => "Queue not found."
    ]);
    exit;
}

$currentQueue = $result->fetch_assoc();

/*
|--------------------------------------------------------------------------
| GET CURRENTLY SERVING
|--------------------------------------------------------------------------
*/

$sql = "
SELECT
    queue_number
FROM queue_tickets
WHERE
    window_id = ?
AND status = 'in_progress'
LIMIT 1
";

$stmt = $conn->prepare($sql);
$stmt->bind_param("i", $currentQueue["window_id"]);
$stmt->execute();

$result = $stmt->get_result();

$serving = $result->fetch_assoc();

$nowServing = $serving["queue_number"] ?? null;

/*
|--------------------------------------------------------------------------
| PEOPLE AHEAD
|--------------------------------------------------------------------------
*/

$sql = "
SELECT COUNT(*) AS total
FROM queue_tickets
WHERE
window_id = ?
AND status='waiting'
AND joined_at < ?
";

$stmt = $conn->prepare($sql);
$stmt->bind_param(
    "is",
    $currentQueue["window_id"],
    $currentQueue["joined_at"]
);

$stmt->execute();

$result = $stmt->get_result();

$peopleAhead = intval(
    $result->fetch_assoc()["total"]
);

/*
|--------------------------------------------------------------------------
| QUEUE LIST
|--------------------------------------------------------------------------
*/

$sql = "
SELECT
    qt.id,
    qt.queue_number,
    qt.status,
    qt.joined_at
FROM queue_tickets qt
WHERE
    qt.window_id = ?
AND qt.status IN ('waiting','in_progress')
ORDER BY qt.joined_at ASC
";

$stmt = $conn->prepare($sql);
$stmt->bind_param("i", $currentQueue["window_id"]);
$stmt->execute();

$result = $stmt->get_result();

$queueList = [];

while ($row = $result->fetch_assoc()) {

    $row["is_you"] = ($row["id"] == $queueId);

    $queueList[] = $row;
}

/*
|--------------------------------------------------------------------------
| ESTIMATED WAITING TIME
|--------------------------------------------------------------------------
|
| Sum of processing_time × quantity
| of ALL students ahead in the queue.
|
*/

$estimatedWait = 0;

$sql = "
SELECT
    qt.id
FROM queue_tickets qt
WHERE
    qt.window_id = ?
AND qt.status = 'waiting'
AND qt.joined_at < ?
ORDER BY qt.joined_at ASC
";

$stmt = $conn->prepare($sql);
$stmt->bind_param(
    "is",
    $currentQueue["window_id"],
    $currentQueue["joined_at"]
);

$stmt->execute();

$result = $stmt->get_result();

while ($ticket = $result->fetch_assoc()) {

    $ticketId = $ticket["id"];

    $sqlSvc = "
    SELECT
        qtd.quantity,
        d.processing_time
    FROM queue_ticket_item qtd

    INNER JOIN service_items d
    ON d.id = qtd.service_item_id

    WHERE qtd.ticket_id = ?
    ";

    $stmtSvc = $conn->prepare($sqlSvc);
    $stmtSvc->bind_param("i", $ticketId);
    $stmtSvc->execute();

    $svcResult = $stmtSvc->get_result();

    while ($svc = $svcResult->fetch_assoc()) {

        $estimatedWait +=
            ($svc["processing_time"] * $svc["quantity"]);

    }

}

/*
|--------------------------------------------------------------------------
| CURRENT USER SERVICE ITEMS
|--------------------------------------------------------------------------
*/

$userServiceItems = [];

$sql = "
SELECT
    d.id,
    d.name,
    d.processing_time,
    qtd.quantity
FROM queue_ticket_item qtd

INNER JOIN service_items d
ON d.id = qtd.service_item_id

WHERE qtd.ticket_id = ?
";

$stmt = $conn->prepare($sql);
$stmt->bind_param("i", $queueId);
$stmt->execute();

$result = $stmt->get_result();

while ($row = $result->fetch_assoc()) {

    $userServiceItems[] = [
        "id" => intval($row["id"]),
        "name" => $row["name"],
        "quantity" => intval($row["quantity"]),
        "processing_time" => intval($row["processing_time"])
    ];

}

/*
|--------------------------------------------------------------------------
| FINAL RESPONSE
|--------------------------------------------------------------------------
*/

echo json_encode([
    "success" => true,

    "queue" => [
        "id" => intval($currentQueue["id"]),
        "queue_number" => $currentQueue["queue_number"],
        "status" => $currentQueue["status"],
        "office" => $currentQueue["office_name"],
        "window" => $currentQueue["window_name"],
        "joined_at" => $currentQueue["joined_at"]
    ],

    "now_serving" => $nowServing,

    "people_ahead" => $peopleAhead,

    "estimated_wait" => $estimatedWait,

    "service_items" => $userServiceItems,

    "queue_list" => $queueList

], JSON_UNESCAPED_UNICODE);

$conn->close();