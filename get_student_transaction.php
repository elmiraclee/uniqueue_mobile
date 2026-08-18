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
    FOR QUEUE HISTORY
    Uncomment the line:
    AND qt.status = 'done'
    kapag gusto mo history lang ang ipakita.
*/

$sql = "
SELECT
    qt.id,
    qt.queue_number,
    qt.type,
    qt.status,
    qt.priority,
    qt.priority_reason,

    qt.joined_at,
    qt.called_at,
    qt.done_at,
    qt.created_at,

    DATE(qt.created_at) AS transaction_date,
    TIME(qt.created_at) AS transaction_time,

    o.name AS office_name,
    w.name AS window_name,
    e.name AS event_name,

    GROUP_CONCAT(
        CONCAT(
            d.name,
            ' (',
            qtd.quantity,
            ')'
        )
        SEPARATOR ', '
    ) AS documents,

    f.rating AS feedback_rating

FROM queue_tickets qt

INNER JOIN offices o
    ON qt.office_id = o.id

LEFT JOIN windows w
    ON qt.window_id = w.id

LEFT JOIN events e
    ON qt.event_id = e.id

LEFT JOIN queue_ticket_document qtd
    ON qt.id = qtd.ticket_id

LEFT JOIN documents d
    ON qtd.document_id = d.id

LEFT JOIN feedbacks f
    ON f.ticket_id = qt.id

WHERE qt.student_id = ?
AND qt.status IN ('completed', 'cancelled')

GROUP BY qt.id

ORDER BY
    CASE
        WHEN qt.status = 'cancelled' THEN 1
        ELSE 0
    END,
    qt.created_at DESC
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

$transactions = [];

while ($row = $result->fetch_assoc()) {

    $row["priority"] = (int)$row["priority"];
    $row["feedback_rating"] = $row["feedback_rating"] !== null ? (int)$row["feedback_rating"] : null;

    $transactions[] = $row;
}

echo json_encode([
    "success" => true,
    "transactions" => $transactions
]);

$stmt->close();
$conn->close();

?>