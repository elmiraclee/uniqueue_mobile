<?php

header("Content-Type: application/json");
include "db.php";

$data = json_decode(file_get_contents("php://input"), true);

$id = $data['id'];

// table is "window_item" (maps windows to service items)
$delSvcStmt = mysqli_prepare($conn, "
    DELETE FROM window_item WHERE window_id = ?
");
mysqli_stmt_bind_param($delSvcStmt, "i", $id);
mysqli_stmt_execute($delSvcStmt);

$delWinStmt = mysqli_prepare($conn, "
    DELETE FROM windows WHERE id = ?
");
mysqli_stmt_bind_param($delWinStmt, "i", $id);
mysqli_stmt_execute($delWinStmt);

echo json_encode([
    "success" => true
]);