<?php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");

include "db.php";

$office_id = $_GET['office_id'];

$sql = "
SELECT *
FROM service_items
WHERE office_id = ?
";

$stmt = $conn->prepare($sql);
$stmt->bind_param("i", $office_id);
$stmt->execute();

$result = $stmt->get_result();

$service_items = [];

while ($row = $result->fetch_assoc()) {

    $service_item_id = $row['id'];

    $reqSql = "
        SELECT requirement
        FROM service_item_requirements
        WHERE service_item_id = ?
    ";

    $reqStmt = $conn->prepare($reqSql);
    $reqStmt->bind_param("i", $service_item_id);
    $reqStmt->execute();

    $reqResult = $reqStmt->get_result();

    $requirements = [];

    while ($req = $reqResult->fetch_assoc()) {
        $requirements[] = $req['requirement'];
    }

    $row['requirements'] = $requirements;

    $service_items[] = $row;
}

echo json_encode([
    "success" => true,
    "service_items" => $service_items
]);