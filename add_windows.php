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

// Mag-save ng service_items kapag kaya ng window mag-handle ng walk-in
// (either dedicated 'walkin' or a 'both' window)
if (
    in_array($queue_type, ['walkin', 'both'], true) &&
    !empty($data['service_items'])
) {

    $svcStmt = mysqli_prepare($conn, "
        INSERT INTO window_item
        (window_id, service_item_id)
        VALUES (?, ?)
    ");

    foreach ($data['service_items'] as $svc) {

        mysqli_stmt_bind_param(
            $svcStmt,
            "ii",
            $window_id,
            $svc
        );

        mysqli_stmt_execute($svcStmt);
    }
}

// Assign staff to this newly created window. Each entry is
// { id: <existing staff id> } picked from the dropdown.
$staffAssigned = 0;
$staffSkipped = [];

if (!empty($data['staff'])) {

    $assignStmt = mysqli_prepare($conn, "
        UPDATE staff
        SET window_id = ?
        WHERE id = ? AND office_id = ?
    ");

    if (!$assignStmt) {
        // If prepare fails (e.g. a column name mismatch), log it instead
        // of failing silently - this is the kind of thing that produces
        // "success: true" responses with window_id never actually set.
        error_log("add_windows.php: failed to prepare staff assign statement: " . mysqli_error($conn));
    } else {

        foreach ($data['staff'] as $member) {

            $staffId = $member['id'] ?? null;

            if (empty($staffId)) {
                continue;
            }

            mysqli_stmt_bind_param(
                $assignStmt,
                "iii",
                $window_id,
                $staffId,
                $office_id
            );

            mysqli_stmt_execute($assignStmt);

            // affected_rows is 0 when the WHERE clause matched no row -
            // typically because the staffId's actual office_id in the
            // staff table doesn't match the office_id sent for this
            // window. That mismatch updates zero rows with no error.
            if (mysqli_stmt_affected_rows($assignStmt) > 0) {
                $staffAssigned++;
            } else {
                $staffSkipped[] = $staffId;
            }
        }
    }
}

echo json_encode([
    "success" => true,
    "message" => "Window added successfully",
    "staff_assigned" => $staffAssigned,
    "staff_skipped" => $staffSkipped, // ids that matched no row for this office_id — useful while debugging
]);
?>