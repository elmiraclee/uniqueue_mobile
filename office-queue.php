<?php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST");
header("Access-Control-Allow-Headers: Content-Type");

include "db.php";

try {

// =====================================================
function findBestWindow($conn, $officeId, $documentIds, $type) {

    $officeId = intval($officeId);
    $type = mysqli_real_escape_string($conn, $type);
    $window = null;

    $documentIds = array_values(array_unique(array_map('intval', $documentIds ?? [])));

    if (!empty($documentIds)) {
        $documentIdsList = implode(',', $documentIds);
        $documentCount = count($documentIds);

        $windowSql = "SELECT w.id, w.name,
                        (SELECT COUNT(*) FROM queue_tickets qt
                         WHERE qt.window_id = w.id
                         AND qt.status IN ('waiting', 'called', 'in_progress')) AS load_count
                      FROM windows w
                      WHERE w.office_id = '$officeId'
                      AND w.status = 'open'
                      AND (w.queue_type = 'both' OR w.queue_type = '$type')
                      AND (
                        SELECT COUNT(DISTINCT wd.document_id)
                        FROM window_document wd
                        WHERE wd.window_id = w.id
                        AND wd.document_id IN ($documentIdsList)
                      ) = $documentCount
                      ORDER BY load_count ASC, w.id ASC
                      LIMIT 1";
        $windowResult = mysqli_query($conn, $windowSql);
        $window = $windowResult ? mysqli_fetch_assoc($windowResult) : null;
    }

    if (!$window) {
        $fallbackSql = "SELECT w.id, w.name,
                        (SELECT COUNT(*) FROM queue_tickets qt
                         WHERE qt.window_id = w.id
                         AND qt.status IN ('waiting', 'called', 'in_progress')) AS load_count
                      FROM windows w
                      WHERE w.office_id = '$officeId'
                      AND w.status = 'open'
                      AND (w.queue_type = 'both' OR w.queue_type = '$type')
                      ORDER BY load_count ASC, w.id ASC
                      LIMIT 1";
        $fallbackResult = mysqli_query($conn, $fallbackSql);
        $window = $fallbackResult ? mysqli_fetch_assoc($fallbackResult) : null;
    }

    return $window; // ['id'=>.., 'name'=>.., 'load_count'=>..] or null
}


function get_office_queue_prefix($conn, $officeId) {

    static $prefixMap = null;

    if ($prefixMap === null) {

        $prefixMap = [];
        $used = [];

        $officesResult = mysqli_query($conn, "SELECT id, name FROM offices WHERE is_active = 1 ORDER BY id ASC");

        while ($o = mysqli_fetch_assoc($officesResult)) {

            $words  = preg_split('/\s+/', trim($o['name']));
            $letter = null;

            // Try the first letter of each word in the office name first
            // (e.g. "Student Affairs" -> S, then A if S is taken).
            foreach ($words as $word) {
                $candidate = strtoupper(substr($word, 0, 1));
                if ($candidate !== '' && !isset($used[$candidate])) {
                    $letter = $candidate;
                    break;
                }
            }

            // All single letters from the name are taken — extend to a
            // longer prefix (RE, REG, ...) built from the letters of the
            // name until it's unique.
            if ($letter === null) {

                $base = strtoupper(preg_replace('/[^A-Za-z]/', '', $o['name']));
                $len  = 2;

                do {
                    $candidate = substr($base, 0, $len);
                    $len++;
                } while ($candidate !== '' && isset($used[$candidate]) && $len <= strlen($base) + 1);

                $letter = $candidate !== '' ? $candidate : 'OFC';

                // Still colliding (e.g. two offices with identical names) —
                // guarantee uniqueness with the office id as a last resort.
                if (isset($used[$letter])) {
                    $letter .= $o['id'];
                }
            }

            $used[$letter]      = true;
            $prefixMap[$o['id']] = $letter;
        }
    }

    return $prefixMap[$officeId] ?? 'Q';
}

function nextQueueNumber($conn, $officeId) {

    $officeId = intval($officeId);

    $countSql = "SELECT COUNT(*) AS total
                 FROM queue_tickets
                 WHERE office_id = '$officeId'
                 AND DATE(created_at) = CURDATE()";
    $countResult = mysqli_query($conn, $countSql);
    $countRow = $countResult ? mysqli_fetch_assoc($countResult) : ['total' => 0];
    $nextSeq = intval($countRow['total']) + 1;

    $prefix = get_office_queue_prefix($conn, $officeId);

    return $prefix . '-' . str_pad($nextSeq, 3, '0', STR_PAD_LEFT);
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {

    $action = $_GET['action'] ?? '';

    if ($action === 'events') {

        $sql = "SELECT e.id, e.office_id, e.name, e.description,
                       e.start_date, e.end_date, o.slug AS office_slug
                FROM events e
                JOIN offices o ON o.id = e.office_id
                WHERE e.status = 'active'
                AND o.is_active = 1
                AND (e.start_date IS NULL OR CURDATE() BETWEEN e.start_date AND e.end_date)
                ORDER BY e.created_at DESC";
        $result = mysqli_query($conn, $sql);
        $events = $result ? mysqli_fetch_all($result, MYSQLI_ASSOC) : [];

        echo json_encode(["success" => true, "events" => $events]);
        exit;
    }

    if ($action === 'event') {

        $eventId = intval($_GET['event_id'] ?? 0);
        $officeId = intval($_GET['office_id'] ?? 0);
        $studentId = intval($_GET['student_id'] ?? 0);

        if (!$eventId || !$officeId) {
            echo json_encode(["success" => false, "message" => "Missing event or office."]);
            exit;
        }

        $evResult = mysqli_query($conn, "
            SELECT * FROM events
            WHERE id = '$eventId' AND office_id = '$officeId' AND status = 'active'
            AND (start_date IS NULL OR CURDATE() BETWEEN start_date AND end_date)
            LIMIT 1
        ");
        $event = $evResult ? mysqli_fetch_assoc($evResult) : null;

        if (!$event) {
            echo json_encode(["success" => false, "message" => "This event is not available."]);
            exit;
        }

        $stepsResult = mysqli_query($conn, "
            SELECT es.id, es.step_order, es.title, es.description, es.office_id,
                   o.name AS office_name, o.slug AS office_slug
            FROM event_steps es
            LEFT JOIN offices o ON o.id = es.office_id
            WHERE es.event_id = '$eventId'
            ORDER BY es.step_order ASC, es.id ASC
        ");
        $steps = $stepsResult ? mysqli_fetch_all($stepsResult, MYSQLI_ASSOC) : [];

        if ($steps) {
            $stepIdsList = implode(',', array_map('intval', array_column($steps, 'id')));

            $esdResult = mysqli_query($conn, "
                SELECT esd.event_step_id, esd.document_id, esd.quantity, d.name
                FROM event_step_documents esd
                INNER JOIN documents d ON d.id = esd.document_id
                WHERE esd.event_step_id IN ($stepIdsList)
            ");
            $esdRows = $esdResult ? mysqli_fetch_all($esdResult, MYSQLI_ASSOC) : [];

            $docIds = array_values(array_unique(array_map('intval', array_column($esdRows, 'document_id'))));
            $requirementsByDoc = [];
            if ($docIds) {
                $docIdsList = implode(',', $docIds);
                $reqResult = mysqli_query($conn, "
                    SELECT id, document_id, requirement
                    FROM document_requirements
                    WHERE document_id IN ($docIdsList)
                    ORDER BY id ASC
                ");
                $reqRows = $reqResult ? mysqli_fetch_all($reqResult, MYSQLI_ASSOC) : [];
                foreach ($reqRows as $row) {
                    $requirementsByDoc[$row['document_id']][] = $row;
                }
            }

            $docsByStep = [];
            foreach ($esdRows as $row) {
                $row['requirements'] = $requirementsByDoc[$row['document_id']] ?? [];
                $docsByStep[$row['event_step_id']][] = $row;
            }

            foreach ($steps as &$s) {
                $s['documents'] = $docsByStep[$s['id']] ?? [];
            }
            unset($s);
        }

        $currentStep = null;
        $currentStepIndex = null;
        $completedStepIds = [];

        if ($studentId) {

            $doneResult = mysqli_query($conn, "
                SELECT event_step_id FROM queue_tickets
                WHERE student_id = '$studentId' AND event_id = '$eventId'
                AND status = 'completed'
            ");
            $doneRows = $doneResult ? mysqli_fetch_all($doneResult, MYSQLI_ASSOC) : [];
            $completedStepIds = array_map('intval', array_column($doneRows, 'event_step_id'));
        }

        foreach ($steps as $i => $s) {
            if (!in_array((int)$s['id'], $completedStepIds, true)) {
                $currentStep = $s;
                $currentStepIndex = $i;
                break;
            }
        }

        $eventCompleted = ($currentStep === null && !empty($steps));

        $activeTicket = null;
        if ($studentId) {
            $activeResult = mysqli_query($conn, "
                SELECT qt.id, qt.queue_number, qt.status, qt.event_step_id, w.name AS window_name
                FROM queue_tickets qt
                LEFT JOIN windows w ON w.id = qt.window_id
                WHERE qt.student_id = '$studentId' AND qt.event_id = '$eventId'
                AND qt.status IN ('waiting', 'called', 'in_progress')
                ORDER BY qt.created_at DESC
                LIMIT 1
            ");
            $activeTicket = $activeResult ? mysqli_fetch_assoc($activeResult) : null;
        }

        echo json_encode([
            "success" => true,
            "event" => $event,
            "steps" => $steps,
            "current_step" => $currentStep,
            "current_step_index" => $currentStepIndex,
            "event_completed" => $eventCompleted,
            "active_ticket" => $activeTicket,
        ]);
        exit;
    }

    echo json_encode(["success" => false, "message" => "Unknown action."]);
    exit;
}


// =====================================================
// POST
// =====================================================

$data = json_decode(file_get_contents("php://input"), true);
$mode = $data['mode'] ?? 'regular';

if ($mode === 'event') {

    $student_id = intval($data['student_id'] ?? 0);
    $event_id = intval($data['event_id'] ?? 0);
    $event_step_id = intval($data['event_step_id'] ?? 0);
    $priority = !empty($data['priority']);
    $priority_reason = trim($data['priority_reason'] ?? '');
    $checked_requirement_ids = array_map('intval', $data['req_check'] ?? []);

    if (!$student_id || !$event_id || !$event_step_id) {
        echo json_encode(["success" => false, "message" => "Missing required fields."]);
        exit;
    }

    $evResult = mysqli_query($conn, "
        SELECT * FROM events
        WHERE id = '$event_id' AND status = 'active'
        AND (start_date IS NULL OR CURDATE() BETWEEN start_date AND end_date)
        LIMIT 1
    ");
    $event = $evResult ? mysqli_fetch_assoc($evResult) : null;

    if (!$event) {
        echo json_encode(["success" => false, "message" => "This event is no longer available."]);
        exit;
    }

    $stepsResult = mysqli_query($conn, "
        SELECT es.id, es.step_order, es.title, es.office_id
        FROM event_steps es
        WHERE es.event_id = '$event_id'
        ORDER BY es.step_order ASC, es.id ASC
    ");
    $steps = $stepsResult ? mysqli_fetch_all($stepsResult, MYSQLI_ASSOC) : [];

    // Same note as the GET branch above: only 'completed' is a real
    // status value for this column.
    $doneResult = mysqli_query($conn, "
        SELECT event_step_id FROM queue_tickets
        WHERE student_id = '$student_id' AND event_id = '$event_id'
        AND status = 'completed'
    ");
    $doneRows = $doneResult ? mysqli_fetch_all($doneResult, MYSQLI_ASSOC) : [];
    $completedStepIds = array_map('intval', array_column($doneRows, 'event_step_id'));

    $currentStep = null;
    foreach ($steps as $s) {
        if (!in_array((int)$s['id'], $completedStepIds, true)) {
            $currentStep = $s;
            break;
        }
    }

    if (!$currentStep || (int)$currentStep['id'] !== $event_step_id) {
        echo json_encode(["success" => false, "message" => "That step is not currently available for you to join."]);
        exit;
    }

    $stepDocsResult = mysqli_query($conn, "
        SELECT document_id, quantity FROM event_step_documents WHERE event_step_id = '$event_step_id'
    ");
    $stepDocs = $stepDocsResult ? mysqli_fetch_all($stepDocsResult, MYSQLI_ASSOC) : [];
    $stepDocIds = array_map('intval', array_column($stepDocs, 'document_id'));

    if ($stepDocIds) {
        $docIdsList = implode(',', $stepDocIds);
        $reqResult = mysqli_query($conn, "SELECT id FROM document_requirements WHERE document_id IN ($docIdsList)");
        $reqRows = $reqResult ? mysqli_fetch_all($reqResult, MYSQLI_ASSOC) : [];
        $requiredIds = array_map('intval', array_column($reqRows, 'id'));

        $missing = array_diff($requiredIds, $checked_requirement_ids);
        if ($missing) {
            echo json_encode(["success" => false, "message" => "Please confirm all requirements are met before joining the queue."]);
            exit;
        }
    }

    $activeResult = mysqli_query($conn, "
        SELECT id FROM queue_tickets
        WHERE student_id = '$student_id' AND status IN ('waiting','called','in_progress')
        LIMIT 1
    ");
    $activeRow = $activeResult ? mysqli_fetch_assoc($activeResult) : null;
    if ($activeRow) {
        echo json_encode(["success" => false, "message" => "You already have an active queue. Finish or cancel it first."]);
        exit;
    }

    $step_office_id = intval($currentStep['office_id']);
    $priority_reason_escaped = mysqli_real_escape_string($conn, $priority_reason);

    $window = findBestWindow($conn, $step_office_id, $stepDocIds, 'walkin');
    if (!$window) {
        echo json_encode(["success" => false, "message" => "No window currently handles this step. Please contact the office."]);
        exit;
    }
    $windowId = intval($window['id']);
    $windowName = $window['name'];

    $priorityFlagInt = $priority ? 1 : 0;
    $queueNumber = nextQueueNumber($conn, $step_office_id);

    $eventStepTitle = empty($stepDocs) ? $currentStep['title'] : null;
    $eventStepTitleSql = $eventStepTitle !== null
        ? "'" . mysqli_real_escape_string($conn, $eventStepTitle) . "'"
        : "NULL";

    $sql = "INSERT INTO queue_tickets(
                student_id, office_id, event_id, event_step_id, event_step_title, type,
                queue_number, status, priority, priority_reason,
                window_id, created_at, updated_at
            )
            VALUES(
                '$student_id', '$step_office_id', '$event_id', '$event_step_id', $eventStepTitleSql, 'walkin',
                '$queueNumber', 'waiting', '$priorityFlagInt',
                " . ($priority_reason_escaped !== '' ? "'$priority_reason_escaped'" : "NULL") . ",
                '$windowId', NOW(), NOW()
            )";

    if (mysqli_query($conn, $sql)) {

        $ticketId = mysqli_insert_id($conn);

        foreach ($stepDocs as $sd) {
            $docId = intval($sd['document_id']);
            $qty = max(1, intval($sd['quantity']));
            mysqli_query($conn, "
                INSERT INTO queue_ticket_document(ticket_id, document_id, quantity)
                VALUES('$ticketId', '$docId', '$qty')
            ");
        }

        echo json_encode([
            "success" => true,
            "message" => "You have joined the queue.",
            "queue_number" => $queueNumber,
            "window_name" => $windowName,
            "step_title" => $currentStep['title'],
        ]);

    } else {
        echo json_encode(["success" => false, "message" => mysqli_error($conn)]);
    }

    exit;
}


$student_id = $data['student_id'] ?? null;
$office_id = $data['office_id'] ?? null;
$type = $data['type'] ?? null; // walkin or appointment
$appointment_slip_confirmed = !empty($data['appointment_slip_confirmed']);
$priority = !empty($data['priority']);
$priority_reason = trim($data['priority_reason'] ?? '');
$documents = $data['documents'] ?? []; // array of { document_id, quantity }


// =====================================================
// BASIC VALIDATION
// =====================================================

if (!$student_id || !$office_id || !$type) {
    echo json_encode([
        "success" => false,
        "message" => "Missing required fields."
    ]);
    exit;
}

if (empty($documents)) {
    echo json_encode([
        "success" => false,
        "message" => "Please select at least one document or service."
    ]);
    exit;
}

$student_id = intval($student_id);
$office_id = intval($office_id);
$type = mysqli_real_escape_string($conn, $type);


if ($type === 'appointment' && !$appointment_slip_confirmed) {
    echo json_encode([
        "success" => false,
        "message" => "Please confirm you have your Appointment Slip."
    ]);
    exit;
}

$configResult = mysqli_query(
    $conn,
    "SELECT priority_enabled FROM office_configs WHERE office_id = '$office_id' LIMIT 1"
);
$config = $configResult ? mysqli_fetch_assoc($configResult) : null;
$priorityEnabledForOffice = $config === null || $config['priority_enabled'] === null
    ? true
    : (bool) intval($config['priority_enabled']);

if ($priority && !$priorityEnabledForOffice) {
    $priority = false;
    $priority_reason = '';
}

if ($priority && $priority_reason === '') {
    echo json_encode([
        "success" => false,
        "message" => "Please enter a reason for priority lane."
    ]);
    exit;
}

$priority_reason_escaped = mysqli_real_escape_string($conn, $priority_reason);

$normalizedDocuments = [];

foreach ($documents as $doc) {
    if (is_array($doc)) {
        $documentId = intval($doc['document_id'] ?? 0);
        $quantity = intval($doc['quantity'] ?? 1);
    } else {
        $documentId = intval($doc);
        $quantity = 1;
    }

    if ($documentId <= 0) {
        continue;
    }

    $normalizedDocuments[] = [
        'document_id' => $documentId,
        'quantity' => max(1, $quantity),
    ];
}

if (empty($normalizedDocuments)) {
    echo json_encode([
        "success" => false,
        "message" => "Please select at least one document or service."
    ]);
    exit;
}


// =====================================================
// QUEUE NUMBER
// =====================================================

$priorityFlagInt = $priority ? 1 : 0;
$queueNumber = nextQueueNumber($conn, $office_id);


// =====================================================
// WINDOW ASSIGNMENT
// =====================================================

$documentIds = array_column($normalizedDocuments, 'document_id');
$window = findBestWindow($conn, $office_id, $documentIds, $type);

$windowId = $window ? intval($window['id']) : null;
$windowName = $window ? $window['name'] : 'Not Assigned';


// =====================================================
// INSERT QUEUE TICKET
// =====================================================

$windowIdSql = $windowId !== null ? "'$windowId'" : "NULL";

$sql = "INSERT INTO queue_tickets(
            student_id,
            office_id,
            type,
            queue_number,
            status,
            priority,
            priority_reason,
            window_id,
            created_at,
            updated_at
        )
        VALUES(
            '$student_id',
            '$office_id',
            '$type',
            '$queueNumber',
            'waiting',
            '$priorityFlagInt',
            " . ($priority_reason_escaped !== '' ? "'$priority_reason_escaped'" : "NULL") . ",
            $windowIdSql,
            NOW(),
            NOW()
        )";

if (mysqli_query($conn, $sql)) {

    $ticketId = mysqli_insert_id($conn);

    // =====================================================
    // SAVE DOCUMENTS (with quantity)
    // =====================================================

    foreach ($normalizedDocuments as $doc) {
        mysqli_query(
            $conn,
            "INSERT INTO queue_ticket_document(
                ticket_id,
                document_id,
                quantity
            )
            VALUES(
                '$ticketId',
                '{$doc['document_id']}',
                '{$doc['quantity']}'
            )"
        );
    }

    echo json_encode([
        "success" => true,
        "message" => "You have joined the queue.",
        "queue_number" => $queueNumber,
        "window_name" => $windowName,
    ]);

} else {

    echo json_encode([
        "success" => false,
        "message" => mysqli_error($conn)
    ]);
}

} catch (\Throwable $e) {

    echo json_encode([
        "success" => false,
        "message" => "Server error: " . $e->getMessage()
    ]);
}