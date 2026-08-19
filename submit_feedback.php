<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type");

require_once "db.php";

$data = json_decode(file_get_contents("php://input"), true);

$ticket_id  = isset($data["ticket_id"]) ? (int)$data["ticket_id"] : 0;
$student_id = isset($data["student_id"]) ? (int)$data["student_id"] : 0;
$rating     = isset($data["rating"]) ? (int)$data["rating"] : 0;
$comment    = isset($data["comment"]) ? trim($data["comment"]) : null;

if ($comment === "") {
    $comment = null; // optional field, keep NULL instead of empty string
}

if ($ticket_id <= 0 || $student_id <= 0) {
    echo json_encode([
        "success" => false,
        "message" => "Invalid transaction or student."
    ]);
    exit;
}

if ($rating < 1 || $rating > 5) {
    echo json_encode([
        "success" => false,
        "message" => "Rating must be between 1 and 5 stars."
    ]);
    exit;
}

// Make sure the ticket actually belongs to this student and is
// completed -- prevents rating someone else's transaction, or one
// that's still waiting/in_progress/cancelled.
$checkSql = "
    SELECT id
    FROM queue_tickets
    WHERE id = ?
    AND student_id = ?
    AND status = 'completed'
";

$checkStmt = $conn->prepare($checkSql);
$checkStmt->bind_param("ii", $ticket_id, $student_id);
$checkStmt->execute();
$checkResult = $checkStmt->get_result();

if ($checkResult->num_rows === 0) {
    echo json_encode([
        "success" => false,
        "message" => "Transaction not found or not yet completed."
    ]);
    $checkStmt->close();
    $conn->close();
    exit;
}
$checkStmt->close();

// Already rated? (also enforced by the DB's UNIQUE key as a fallback)
$dupSql = "SELECT id FROM feedbacks WHERE ticket_id = ?";
$dupStmt = $conn->prepare($dupSql);
$dupStmt->bind_param("i", $ticket_id);
$dupStmt->execute();
$dupResult = $dupStmt->get_result();

if ($dupResult->num_rows > 0) {
    echo json_encode([
        "success" => false,
        "message" => "Feedback was already submitted for this transaction."
    ]);
    $dupStmt->close();
    $conn->close();
    exit;
}
$dupStmt->close();

$insertSql = "
    INSERT INTO feedbacks (ticket_id, student_id, rating, comment, created_at)
    VALUES (?, ?, ?, ?, NOW())
";

$insertStmt = $conn->prepare($insertSql);
$insertStmt->bind_param("iiis", $ticket_id, $student_id, $rating, $comment);

if ($insertStmt->execute()) {
    echo json_encode([
        "success" => true,
        "message" => "Feedback submitted successfully."
    ]);
} else {
    // Likely a race on the UNIQUE key (duplicate submit) or FK mismatch
    echo json_encode([
        "success" => false,
        "message" => "Could not save feedback: " . $conn->error
    ]);
}

$insertStmt->close();
$conn->close();
?>