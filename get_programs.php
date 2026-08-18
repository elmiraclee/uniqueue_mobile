<?php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");

include "db.php";

$college_id = intval($_GET['college_id'] ?? 0);

if ($college_id <= 0) {
    echo json_encode([]);
    exit;
}

$stmt = $conn->prepare(
    "SELECT id, name
     FROM programs
     WHERE college_id = ?
     AND is_active = 1
     ORDER BY name ASC"
);

$stmt->bind_param("i", $college_id);
$stmt->execute();

$result = $stmt->get_result();

$programs = [];

while ($row = $result->fetch_assoc()) {

    $programs[] = [
        "program_id" => $row['id'],
        "program_name" => $row['name']
    ];
}

echo json_encode($programs);

$stmt->close();
$conn->close();

?>