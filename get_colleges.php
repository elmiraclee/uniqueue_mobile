<?php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");

include "db.php";

$colleges = [];

$sql = "SELECT id, name
        FROM colleges
        WHERE is_active = 1
        ORDER BY name ASC";

$result = mysqli_query($conn, $sql);

if (!$result) {

    echo json_encode([
        "success" => false,
        "message" => mysqli_error($conn)
    ]);

    exit;
}

while ($row = mysqli_fetch_assoc($result)) {

    $colleges[] = [
        "college_id" => $row['id'],
        "college_name" => $row['name']
    ];
}

echo json_encode($colleges);

mysqli_close($conn);

?>