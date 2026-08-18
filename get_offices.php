<?php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");

include "db.php";

$sql = "SELECT id, name, slug, description
        FROM offices
        WHERE is_active = 1
        ORDER BY name ASC";

$result = mysqli_query($conn, $sql);

$offices = [];

while($row = mysqli_fetch_assoc($result)){
    $offices[] = $row;
}

echo json_encode([
    "success" => true,
    "offices" => $offices
]);