<?php

header("Content-Type: application/json");
include "db.php";

$office_id = $_GET['office_id'];

$stmt = mysqli_prepare($conn, "
    SELECT
        id,
        name,
        office_id,
        status,
        speed,
        queue_type,
        appointment_date
    FROM windows
    WHERE office_id = ?
");

mysqli_stmt_bind_param($stmt, "i", $office_id);
mysqli_stmt_execute($stmt);

$result = mysqli_stmt_get_result($stmt);

$windows = [];

while ($row = mysqli_fetch_assoc($result)) {

    $window_id = $row['id'];

    $svcItems = [];

    // Kukunin ang service_items kapag kaya ng window mag-handle ng walk-in
    // (either dedicated 'walkin' or a 'both' window)
    if (in_array($row['queue_type'], ['walkin', 'both'], true)) {

        $svcStmt = mysqli_prepare($conn, "
            SELECT d.id, d.name
            FROM window_item wd
            INNER JOIN service_items d
                ON wd.service_item_id = d.id
            WHERE wd.window_id = ?
        ");

        mysqli_stmt_bind_param($svcStmt, "i", $window_id);
        mysqli_stmt_execute($svcStmt);

        $svcResult = mysqli_stmt_get_result($svcStmt);

        while ($svc = mysqli_fetch_assoc($svcResult)) {
            $svcItems[] = $svc;
        }
    }

    // Staff currently assigned to this window
    $staff = [];

    $staffStmt = mysqli_prepare($conn, "
        SELECT id, name, position, status
        FROM staff
        WHERE window_id = ?
    ");

    mysqli_stmt_bind_param($staffStmt, "i", $window_id);
    mysqli_stmt_execute($staffStmt);

    $staffResult = mysqli_stmt_get_result($staffStmt);

    while ($member = mysqli_fetch_assoc($staffResult)) {
        $staff[] = $member;
    }

    $windows[] = [
        "id" => $row['id'],
        "name" => $row['name'],
        "office_id" => $row['office_id'],
        "status" => $row['status'],
        "speed" => $row['speed'],
        "queue_type" => $row['queue_type'],
        "appointment_date" => $row['appointment_date'],
        "service_items" => $svcItems,
        "staff" => $staff
    ];
}

echo json_encode([
    "success" => true,
    "windows" => $windows
]);

?>