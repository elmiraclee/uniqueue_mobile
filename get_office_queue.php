<?php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");

include "db.php";

$office_id = isset($_GET['office_id']) ? intval($_GET['office_id']) : 0;

if (!$office_id) {
    echo json_encode([
        "success" => false,
        "message" => "office_id is required."
    ]);
    exit;
}

/*
|--------------------------------------------------------------------------
| OFFICE INFO
|--------------------------------------------------------------------------
*/

$stmt = mysqli_prepare($conn, "
    SELECT id, name, slug, description
    FROM offices
    WHERE id = ? AND is_active = 1
    LIMIT 1
");

mysqli_stmt_bind_param($stmt, "i", $office_id);
mysqli_stmt_execute($stmt);
$officeResult = mysqli_stmt_get_result($stmt);

if (mysqli_num_rows($officeResult) === 0) {
    echo json_encode([
        "success" => false,
        "message" => "Office not found."
    ]);
    exit;
}

$office = mysqli_fetch_assoc($officeResult);

/*
|--------------------------------------------------------------------------
| OPEN WINDOWS
|--------------------------------------------------------------------------
*/

$stmt = mysqli_prepare($conn, "
    SELECT id, name, status, speed, queue_type, is_paused
    FROM windows
    WHERE office_id = ? AND status = 'open'
    ORDER BY name ASC
");

mysqli_stmt_bind_param($stmt, "i", $office_id);
mysqli_stmt_execute($stmt);
$windowResult = mysqli_stmt_get_result($stmt);

$windows = [];
$windowIds = [];

while ($row = mysqli_fetch_assoc($windowResult)) {
    $row['id'] = intval($row['id']);
    $row['is_paused'] = (bool) $row['is_paused'];
    $windows[] = $row;
    $windowIds[] = $row['id'];
}

/*
|--------------------------------------------------------------------------
| LIVE QUEUE PER WINDOW
| — all waiting/in_progress tickets across all open windows
|--------------------------------------------------------------------------
*/

$queueByWindow = [];

if (!empty($windowIds)) {
    $placeholders = implode(',', array_fill(0, count($windowIds), '?'));
    $types = str_repeat('i', count($windowIds));

    $stmt = mysqli_prepare($conn, "
        SELECT
            qt.id,
            qt.queue_number,
            qt.status,
            qt.window_id,
            qt.priority,
            qt.joined_at,
            w.name AS window_name
        FROM queue_tickets qt
        INNER JOIN windows w ON w.id = qt.window_id
        WHERE qt.window_id IN ($placeholders)
        AND qt.status IN ('waiting', 'in_progress', 'called')
        ORDER BY
            qt.window_id ASC,
            FIELD(qt.status, 'in_progress', 'called', 'waiting'),
            qt.priority DESC,
            qt.joined_at ASC
    ");

    mysqli_stmt_bind_param($stmt, $types, ...$windowIds);
    mysqli_stmt_execute($stmt);
    $queueResult = mysqli_stmt_get_result($stmt);

    while ($row = mysqli_fetch_assoc($queueResult)) {
        $wid = intval($row['window_id']);
        if (!isset($queueByWindow[$wid])) {
            $queueByWindow[$wid] = [];
        }
        $queueByWindow[$wid][] = [
            "id"           => intval($row['id']),
            "queue_number" => $row['queue_number'],
            "status"       => $row['status'],
            "priority"     => (bool) $row['priority'],
            "joined_at"    => $row['joined_at'],
        ];
    }
}

/*
|--------------------------------------------------------------------------
| BUILD FINAL WINDOWS PAYLOAD
| — attach queue list + now_serving + waiting count per window
|--------------------------------------------------------------------------
*/

$windowsPayload = [];

foreach ($windows as $w) {
    $wid = $w['id'];
    $tickets = $queueByWindow[$wid] ?? [];

    $nowServing = null;
    $waitingCount = 0;

    foreach ($tickets as $t) {
        if (in_array($t['status'], ['in_progress', 'called']) && $nowServing === null) {
            $nowServing = $t['queue_number'];
        }
        if ($t['status'] === 'waiting') {
            $waitingCount++;
        }
    }

    $windowsPayload[] = [
        "id"           => $wid,
        "name"         => $w['name'],
        "speed"        => $w['speed'],
        "queue_type"   => $w['queue_type'],
        "is_paused"    => $w['is_paused'],
        "now_serving"  => $nowServing,
        "waiting"      => $waitingCount,
        "queue"        => $tickets,
    ];
}

/*
|--------------------------------------------------------------------------
| RESPONSE
|--------------------------------------------------------------------------
*/

echo json_encode([
    "success"      => true,
    "office"       => $office,
    "open_windows" => count($windows),
    "windows"      => $windowsPayload,
], JSON_UNESCAPED_UNICODE);

$conn->close();