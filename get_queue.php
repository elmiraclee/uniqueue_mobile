<?php

header("Content-Type: application/json");

error_reporting(E_ALL);
ini_set('display_errors', 1);

include "db.php";

/*
 * Actual schema (from uniqueue.sql):
 *
 * queue_tickets:
 *   id, student_id, office_id, window_id, queue_number,
 *   type            ENUM('walkin','appointment'),
 *   status          ENUM('waiting','called','in_progress','done','cancelled'),
 *   priority, priority_reason, appointment_date,
 *   notified_at_3, notified_at_called,
 *   joined_at, called_at, done_at, created_at, updated_at
 *
 * students:
 *   id, first_name, last_name, sr_code, college_id, program_id, year_level, password, ...
 *
 * windows:
 *   id, name, office_id, status, speed, queue_type, appointment_date
 *
 * "Currently in the queue" is treated as status IN ('waiting', 'called', 'in_progress').
 */

$office_id = $_GET['office_id'] ?? null;

if (!$office_id) {
    echo json_encode([
        "success" => false,
        "message" => "office_id is required"
    ]);
    exit;
}

// Optional filters
$window_id = $_GET['window_id'] ?? null;   // numeric window id
$queue_type = $_GET['queue_type'] ?? null; // 'walkin' or 'appointment'

$allowedQueueTypes = ['walkin', 'appointment'];

if ($queue_type !== null && !in_array($queue_type, $allowedQueueTypes, true)) {
    echo json_encode([
        "success" => false,
        "message" => "Invalid queue_type filter. Must be one of: walkin, appointment"
    ]);
    exit;
}

$sql = "
    SELECT
        qt.id,
        CONCAT(s.first_name, ' ', s.last_name) AS name,
        qt.type AS queue_type,
        qt.status,
        qt.window_id,
        qt.created_at,
        w.name AS window_name
    FROM queue_tickets qt
    JOIN students s ON s.id = qt.student_id
    LEFT JOIN windows w ON w.id = qt.window_id
    WHERE qt.office_id = ?
      AND qt.status IN ('waiting', 'called', 'in_progress')
";

$types = "i";
$params = [$office_id];

if (!empty($window_id)) {
    $sql .= " AND qt.window_id = ?";
    $types .= "i";
    $params[] = $window_id;
}

if (!empty($queue_type)) {
    $sql .= " AND qt.type = ?";
    $types .= "s";
    $params[] = $queue_type;
}

$sql .= " ORDER BY qt.created_at ASC";

$stmt = mysqli_prepare($conn, $sql);

if (!$stmt) {
    echo json_encode([
        "success" => false,
        "message" => mysqli_error($conn)
    ]);
    exit;
}

mysqli_stmt_bind_param($stmt, $types, ...$params);
mysqli_stmt_execute($stmt);

$result = mysqli_stmt_get_result($stmt);

$queue = [];

while ($row = mysqli_fetch_assoc($result)) {
    $queue[] = [
        "id" => (int) $row['id'],
        "name" => $row['name'],
        "queue_type" => $row['queue_type'],
        "status" => $row['status'],
        "window_id" => $row['window_id'] !== null ? (int) $row['window_id'] : null,
        "window_name" => $row['window_name'],
        "created_at" => $row['created_at'],
    ];
}

echo json_encode([
    "success" => true,
    "queue" => $queue
]);
?>