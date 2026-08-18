<?php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type");

include "db.php";

$data = json_decode(file_get_contents("php://input"), true);

$id = $data['id'] ?? 0;
$name = trim($data['name'] ?? '');
$processing_time = intval($data['processing_time'] ?? 0);
$requirements = $data['requirements'] ?? [];

if (!$id) {
    echo json_encode([
        "success" => false,
        "message" => "Missing ID"
    ]);
    exit;
}

if (empty($name) || $processing_time <= 0) {
    echo json_encode([
        "success" => false,
        "message" => "Invalid service item data"
    ]);
    exit;
}

/* =========================
   UPDATE SERVICE ITEM
========================= */

$sql = "UPDATE service_items
        SET name = ?, processing_time = ?
        WHERE id = ?";

$stmt = $conn->prepare($sql);
$stmt->bind_param("sii", $name, $processing_time, $id);

if (!$stmt->execute()) {
    echo json_encode([
        "success" => false,
        "message" => $stmt->error
    ]);
    exit;
}

/* =========================
   DELETE OLD REQUIREMENTS
========================= */

$delStmt = $conn->prepare(
    "DELETE FROM service_item_requirements WHERE service_item_id = ?"
);
$delStmt->bind_param("i", $id);
$delStmt->execute();

/* =========================
   INSERT NEW REQUIREMENTS
========================= */

if (!empty($requirements) && is_array($requirements)) {

    $reqStmt = $conn->prepare(
        "INSERT INTO service_item_requirements (service_item_id, requirement)
         VALUES (?, ?)"
    );

    foreach ($requirements as $req) {

        $req = trim($req);

        if ($req === '') continue;

        $reqStmt->bind_param("is", $id, $req);
        $reqStmt->execute();
    }
}

echo json_encode([
    "success" => true,
    "message" => "Service Item updated successfully"
]);