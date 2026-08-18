<?php

header("Content-Type: application/json");

error_reporting(E_ALL);
ini_set('display_errors', 1);

include "db.php";

$data = json_decode(file_get_contents("php://input"), true);

$id = $data['id'] ?? 0;

if (!$id) {
    echo json_encode([
        "success" => false,
        "message" => "Missing staff id"
    ]);
    exit;
}

$stmt = mysqli_prepare($conn, "DELETE FROM staff WHERE id = ?");

if (!$stmt) {
    echo json_encode([
        "success" => false,
        "message" => mysqli_error($conn)
    ]);
    exit;
}

mysqli_stmt_bind_param($stmt, "i", $id);

if (!mysqli_stmt_execute($stmt)) {
    echo json_encode([
        "success" => false,
        "message" => mysqli_stmt_error($stmt)
    ]);
    exit;
}

echo json_encode([
    "success" => true,
    "message" => "Staff member deleted successfully"
]);
?>