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

    $docs = [];

    // Kukunin ang documents kapag kaya ng window mag-handle ng walk-in
    // (either dedicated 'walkin' or a 'both' window)
    if (in_array($row['queue_type'], ['walkin', 'both'], true)) {

        $docStmt = mysqli_prepare($conn, "
            SELECT d.id, d.name
            FROM window_document wd
            INNER JOIN documents d
                ON wd.document_id = d.id
            WHERE wd.window_id = ?
        ");

        mysqli_stmt_bind_param($docStmt, "i", $window_id);
        mysqli_stmt_execute($docStmt);

        $docResult = mysqli_stmt_get_result($docStmt);

        while ($doc = mysqli_fetch_assoc($docResult)) {
            $docs[] = $doc;
        }
    }

    $windows[] = [
        "id" => $row['id'],
        "name" => $row['name'],
        "office_id" => $row['office_id'],
        "status" => $row['status'],
        "speed" => $row['speed'],
        "queue_type" => $row['queue_type'],
        "appointment_date" => $row['appointment_date'],
        "documents" => $docs
    ];
}

echo json_encode([
    "success" => true,
    "windows" => $windows
]);

?>