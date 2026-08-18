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
    DELETE FROM window_item
    WHERE window_id = ?
");

mysqli_stmt_bind_param($delStmt, "i", $id);
mysqli_stmt_execute($delStmt);

$svcStmt = mysqli_prepare($conn, "
    INSERT INTO window_item (window_id, service_item_id)
    VALUES (?, ?)
");

foreach (($data['service_items'] ?? []) as $svc) {
    mysqli_stmt_bind_param($svcStmt, "ii", $id, $svc);
    mysqli_stmt_execute($svcStmt);
}

// Reassign staff for this window without deleting anyone from the roster:
// 1) unassign everyone currently on this window
// 2) re-assign whoever is in the submitted list (existing roster picks by id)

// office_id isn't part of this endpoint's payload, so look it up from the window itself.
// NOTE: use bind_result instead of mysqli_stmt_get_result() — get_result()
// requires the mysqlnd driver and silently fails (returns false) on servers
// running the older libmysqlclient driver. That failure was the actual
// cause of $office_id staying null, which made the whole staff-assignment
// block below get skipped every time, even though this endpoint always
// reported success.
$officeStmt = mysqli_prepare($conn, "SELECT office_id FROM windows WHERE id = ?");
mysqli_stmt_bind_param($officeStmt, "i", $id);
mysqli_stmt_execute($officeStmt);
mysqli_stmt_bind_result($officeStmt, $office_id);
mysqli_stmt_fetch($officeStmt);
mysqli_stmt_close($officeStmt);

$unassignStmt = mysqli_prepare($conn, "UPDATE staff SET window_id = NULL WHERE window_id = ?");
mysqli_stmt_bind_param($unassignStmt, "i", $id);
mysqli_stmt_execute($unassignStmt);

$staffAssigned = 0;
$staffSkipped = [];

if (!empty($data['staff']) && $office_id !== null) {

    $assignStmt = mysqli_prepare($conn, "
        UPDATE staff
        SET window_id = ?
        WHERE id = ? AND office_id = ?
    ");

    if (!$assignStmt) {
        error_log("update_windows.php: failed to prepare staff assign statement: " . mysqli_error($conn));
    } else {

        foreach ($data['staff'] as $member) {

            $staffId = $member['id'] ?? null;

            if (empty($staffId)) {
                continue;
            }

            mysqli_stmt_bind_param(
                $assignStmt,
                "iii",
                $id,
                $staffId,
                $office_id
            );

            mysqli_stmt_execute($assignStmt);

            // affected_rows is 0 if the WHERE clause matched nobody
            // (e.g. staffId belongs to a different office_id than the
            // window). That's the other common way this ends up NULL:
            // the id/office_id pair sent by the client doesn't match a
            // row, so the UPDATE quietly touches nothing.
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
    "staff_assigned" => $staffAssigned,
    "staff_skipped" => $staffSkipped, // ids that matched no row for this office_id — useful while debugging
]);
?>