<?php

header("Content-Type: application/json");

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

$name = trim($data['name'] ?? '');
$position = trim($data['position'] ?? '');
$office_id = $data['office_id'] ?? 0;
$status = $data['status'] ?? 'active';

if ($name === '') {
    echo json_encode([
        "success" => false,
        "message" => "Please enter a staff name"
    ]);
    exit;
}

if (!$office_id) {
    echo json_encode([
        "success" => false,
        "message" => "Missing office_id"
    ]);
    exit;
}

if (!in_array($status, ['active', 'inactive'], true)) {
    $status = 'active';
}

// New staff members start unassigned; they get attached to a window
// from the Window Configuration screen.
$stmt = mysqli_prepare($conn, "
    INSERT INTO staff
    (name, position, office_id, window_id, status)
    VALUES (?, ?, ?, NULL, ?)
");

if (!$stmt) {
    echo json_encode([
        "success" => false,
        "message" => mysqli_error($conn)
    ]);
    exit;
}

mysqli_stmt_bind_param(
    $stmt,
    "ssis",
    $name,
    $position,
    $office_id,
    $status
);

if (!mysqli_stmt_execute($stmt)) {
    echo json_encode([
        "success" => false,
        "message" => mysqli_stmt_error($stmt)
    ]);
    exit;
}

echo json_encode([
    "success" => true,
    "message" => "Staff member added successfully",
    "id" => mysqli_insert_id($conn)
]);
?>