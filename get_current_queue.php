<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type");

require_once "db.php";

$data = json_decode(file_get_contents("php://input"), true);

$student_id = $data["student_id"] ?? 0;

$sql = "
SELECT
    qt.id,
    qt.queue_number,
    qt.status,
    qt.type,
    qt.joined_at,
    o.name AS office_name,
    w.name AS window_name
FROM queue_tickets qt
LEFT JOIN offices o ON qt.office_id = o.id
LEFT JOIN windows w ON qt.window_id = w.id
WHERE qt.student_id = ?
AND qt.status IN ('waiting','called','in_progress')
ORDER BY qt.created_at DESC
LIMIT 1
";

$stmt = $conn->prepare($sql);
$stmt->bind_param("i", $student_id);
$stmt->execute();

$result = $stmt->get_result();

if($result->num_rows > 0){
    echo json_encode([
        "success"=>true,
        "queue"=>$result->fetch_assoc()
    ]);
}else{
    echo json_encode([
        "success"=>false
    ]);
}