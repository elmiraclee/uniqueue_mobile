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

$name = $data['name'] ?? '';
$office_id = $data['office_id'] ?? 0;
$status = $data['status'] ?? '';
$speed = $data['speed'] ?? '';
$queue_type = $data['queue_type'] ?? 'walkin';
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
    INSERT INTO windows
    (
        name,
        office_id,
        status,
        speed,
        queue_type,
        appointment_date
    )
    VALUES (?, ?, ?, ?, ?, ?)
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
    "sissss",
    $name,
    $office_id,
    $status,
    $speed,
    $queue_type,
    $appointment_date
);

if (!mysqli_stmt_execute($stmt)) {
    echo json_encode([
        "success" => false,
        "message" => mysqli_stmt_error($stmt)
    ]);
    exit;
}

$window_id = mysqli_insert_id($conn);

// Mag-save ng documents kapag kaya ng window mag-handle ng walk-in
// (either dedicated 'walkin' or a 'both' window)
if (
    in_array($queue_type, ['walkin', 'both'], true) &&
    !empty($data['documents'])
) {

    $docStmt = mysqli_prepare($conn, "
        INSERT INTO window_document
        (window_id, document_id)
        VALUES (?, ?)
    ");

    foreach ($data['documents'] as $doc) {

        mysqli_stmt_bind_param(
            $docStmt,
            "ii",
            $window_id,
            $doc
        );

        mysqli_stmt_execute($docStmt);
    }
}

echo json_encode([
    "success" => true,
    "message" => "Window added successfully"
]);
?>