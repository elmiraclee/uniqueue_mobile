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

$id = $data['id'] ?? 0;
$name = trim($data['name'] ?? '');
$position = trim($data['position'] ?? '');
$status = $data['status'] ?? 'active';

if (!$id) {
    // TEMP DIAGNOSTIC: echoes back exactly what the server received so we
    // can see whether 'id' is truly absent, null, 0, or something
    // unexpected like a string. Remove the "received" field once this is
    // root-caused - it's only here to make the next test conclusive
    // instead of another guess.
    echo json_encode([
        "success" => false,
        "message" => "Missing staff id",
        "received" => $data
    ]);
    exit;
}

if ($name === '') {
    echo json_encode([
        "success" => false,
        "message" => "Please enter a staff name"
    ]);
    exit;
}

if (!in_array($status, ['active', 'inactive'], true)) {
    $status = 'active';
}

// Window assignment is intentionally left untouched here — it's managed
// from the Window Configuration screen so a staff member can only ever
// belong to one window at a time.
$stmt = mysqli_prepare($conn, "
    UPDATE staff
    SET name = ?, position = ?, status = ?
    WHERE id = ?
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
    "sssi",
    $name,
    $position,
    $status,
    $id
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
    "message" => "Staff member updated successfully"
]);
?>