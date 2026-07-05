<?php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");

include "db.php";

$slug = isset($_GET['slug']) ? mysqli_real_escape_string($conn, $_GET['slug']) : '';

if ($slug === '') {
    echo json_encode([
        "success" => false,
        "message" => "Missing office slug."
    ]);
    exit;
}

// office_configs is optional per office (LEFT JOIN) — if a row doesn't
// exist yet for this office, walkin_enabled / appointment_enabled /
// priority_enabled all come back NULL, and the app's fetchOffice()
// already treats NULL as "enabled" (its fallback-to-enabled logic).
$sql = "SELECT
            o.id,
            o.name,
            o.slug,
            o.description,
            oc.walkin_enabled,
            oc.appointment_enabled,
            oc.priority_enabled
        FROM offices o
        LEFT JOIN office_configs oc
            ON oc.office_id = o.id
        WHERE o.slug = '$slug'
        AND o.is_active = 1
        LIMIT 1";

$result = mysqli_query($conn, $sql);

if (!$result) {
    echo json_encode([
        "success" => false,
        "message" => mysqli_error($conn)
    ]);
    exit;
}

if (mysqli_num_rows($result) === 0) {
    echo json_encode([
        "success" => false,
        "message" => "Office not found."
    ]);
    exit;
}

$office = mysqli_fetch_assoc($result);

// Normalize to real booleans (or null) instead of "0"/"1" strings, since
// the app checks `=== false` explicitly.
foreach (['walkin_enabled', 'appointment_enabled', 'priority_enabled'] as $flag) {
    $office[$flag] = $office[$flag] === null ? null : (bool) intval($office[$flag]);
}

echo json_encode([
    "success" => true,
    "office" => $office
]);