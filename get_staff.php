<?php

header("Content-Type: application/json");

error_reporting(E_ALL);
ini_set('display_errors', 1);

include "db.php";

$office_id = $_GET['office_id'] ?? 0;

if (!$office_id) {
    echo json_encode([
        "success" => false,
        "message" => "Missing office_id"
    ]);
    exit;
}

$stmt = mysqli_prepare($conn, "
    SELECT
        s.id,
        s.name,
        s.position,
        s.office_id,
        s.window_id,
        s.status,
        w.name AS window_name
    FROM staff s
    LEFT JOIN windows w ON w.id = s.window_id
    WHERE s.office_id = ?
    ORDER BY s.name ASC
");

if (!$stmt) {
    echo json_encode([
        "success" => false,
        "message" => mysqli_error($conn)
    ]);
    exit;
}

mysqli_stmt_bind_param($stmt, "i", $office_id);
mysqli_stmt_execute($stmt);

$result = mysqli_stmt_get_result($stmt);

$staff = [];

while ($row = mysqli_fetch_assoc($result)) {

    $staff[] = [
        "id" => (int) $row['id'],
        "name" => $row['name'],
        "position" => $row['position'],
        "office_id" => (int) $row['office_id'],
        "window_id" => $row['window_id'] !== null ? (int) $row['window_id'] : null,
        "window_name" => $row['window_name'],
        "status" => $row['status'],
    ];
}

echo json_encode([
    "success" => true,
    "staff" => $staff
]);
?>