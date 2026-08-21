<?php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");

include "db.php";

$sql = "SELECT 
            o.id,
            o.name,
            o.slug,
            o.description,
            (
                SELECT COUNT(*)
                FROM windows w
                WHERE w.office_id = o.id
                AND w.status = 'open'
            ) AS open_windows
        FROM offices o
        WHERE o.is_active = 1
        ORDER BY o.name ASC";

$result = mysqli_query($conn, $sql);

$offices = [];

while($row = mysqli_fetch_assoc($result)){
    $row['open_windows'] = intval($row['open_windows']);
    $offices[] = $row;
}

echo json_encode([
    "success" => true,
    "offices" => $offices
]);