<?php

header("Content-Type: application/json");

error_reporting(E_ALL);
ini_set('display_errors', 1);

include "db.php";

$data = json_decode(file_get_contents("php://input"), true);

$id = $data['id'];
$queue_type = $data['queue_type'] ?? '';
$appointment_date = $data['appointment_date'] ?? null;

// A window can now handle walk-in, appointment, or both
$allowedQueueTypes = ['walkin', 'appointment', 'both'];

if (!in_array($queue_type, $allowedQueueTypes, true)) {
    echo json_encode([
        "success" => false,
        "message" => "Invalid queue_type. Must be one of: walkin, appointment, both"
    ]);
    exit;
}

// Appointment date is only applicable (and required) when the window
// handles appointments, either exclusively or alongside walk-ins.
$needsAppointmentDate = in_array($queue_type, ['appointment', 'both'], true);

if ($needsAppointmentDate) {

    // Appointment date is optional; only validate its format if one was provided.
    if (!empty($appointment_date)) {

        $parsedDate = DateTime::createFromFormat('Y-m-d', $appointment_date);

        if (!$parsedDate || $parsedDate->format('Y-m-d') !== $appointment_date) {
            echo json_encode([
                "success" => false,
                "message" => "Invalid appointment date format. Use YYYY-MM-DD."
            ]);
            exit;
        }
    } else {
        $appointment_date = null;
    }

} else {
    // Not applicable for a pure walk-in window
    $appointment_date = null;
}

$stmt = mysqli_prepare($conn, "
    UPDATE windows
    SET name = ?, status = ?, speed = ?, queue_type = ?, appointment_date = ?
    WHERE id = ?
");

mysqli_stmt_bind_param(
    $stmt,
    "sssssi",
    $data['name'],
    $data['status'],
    $data['speed'],
    $queue_type,
    $appointment_date,
    $id
);

if (!mysqli_stmt_execute($stmt)) {
    echo json_encode([
        "success" => false,
        "message" => mysqli_stmt_error($stmt)
    ]);
    exit;
}

$delStmt = mysqli_prepare($conn, "
    DELETE FROM window_document
    WHERE window_id = ?
");

mysqli_stmt_bind_param($delStmt, "i", $id);
mysqli_stmt_execute($delStmt);

$docStmt = mysqli_prepare($conn, "
    INSERT INTO window_document (window_id, document_id)
    VALUES (?, ?)
");

foreach (($data['documents'] ?? []) as $doc) {
    mysqli_stmt_bind_param($docStmt, "ii", $id, $doc);
    mysqli_stmt_execute($docStmt);
}

echo json_encode([
    "success" => true
]);
?>