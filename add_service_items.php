<?php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type");

error_reporting(E_ALL);
ini_set('display_errors', 1);

include "db.php";

$data = json_decode(file_get_contents("php://input"), true);

if (!$data) {
    echo json_encode([
        "success" => false,
        "message" => "No data received"
    ]);
    exit;
}

$office_id = $data['office_id'] ?? null;
$name = $data['name'] ?? '';
$daily_capacity = $data['daily_capacity'] ?? 0;
$processing_time = $data['processing_time'] ?? 0;
$requirements = $data['requirements'] ?? [];

if (empty($office_id) || empty($name)) {
    echo json_encode([
        "success" => false,
        "message" => "Missing fields"
    ]);
    exit;
}

$sql = "INSERT INTO service_items
        (office_id, name, daily_capacity, processing_time)
        VALUES (?, ?, ?, ?)";

$stmt = $conn->prepare($sql);

if (!$stmt) {
    echo json_encode([
        "success" => false,
        "message" => $conn->error
    ]);
    exit;
}

$stmt->bind_param(
    "isii",
    $office_id,
    $name,
    $daily_capacity,
    $processing_time
);

if ($stmt->execute()) {

    $service_item_id = $stmt->insert_id;

    if (!empty($requirements)) {

        $reqSql = "INSERT INTO service_item_requirements
                   (service_item_id, requirement)
                   VALUES (?, ?)";

        $reqStmt = $conn->prepare($reqSql);

        if (!$reqStmt) {
            echo json_encode([
                "success" => false,
                "message" => $conn->error
            ]);
            exit;
        }

        foreach ($requirements as $req) {
            $reqStmt->bind_param("is", $service_item_id, $req);
            $reqStmt->execute();
        }
    }

    echo json_encode([
        "success" => true,
        "message" => "Service Item added successfully"
    ]);

} else {

    echo json_encode([
        "success" => false,
        "message" => $stmt->error
    ]);
}
?>