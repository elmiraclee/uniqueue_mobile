<?php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: POST, OPTIONS");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

include "db.php";

/* =========================
   GET JSON BODY
========================= */

$data = json_decode(file_get_contents("php://input"));

if (!$data) {
    echo json_encode([
        "success" => false,
        "message" => "No input received"
    ]);
    exit;
}

/* =========================
   GET VALUES
========================= */

$sr_code = trim($data->sr_code ?? '');
$first_name = trim($data->first_name ?? '');
$last_name = trim($data->last_name ?? '');
$college_id = intval($data->college_id ?? 0);
$program_id = intval($data->program_id ?? 0);
$password = trim($data->password ?? '');

/* =========================
   VALIDATION
========================= */

if (
    empty($sr_code) ||
    empty($first_name) ||
    empty($last_name) ||
    empty($college_id) ||
    empty($program_id) ||
    empty($password)
) {
    echo json_encode([
        "success" => false,
        "message" => "All fields are required"
    ]);
    exit;
}

/* =========================
   CHECK IF SR CODE EXISTS
========================= */

$check = $conn->prepare(
    "SELECT id FROM students WHERE sr_code = ?"
);

$check->bind_param("s", $sr_code);
$check->execute();

$result = $check->get_result();

if ($result->num_rows > 0) {

    echo json_encode([
        "success" => false,
        "message" => "SR-Code already exists"
    ]);

    exit;
}

/* =========================
   HASH PASSWORD
========================= */

$hashedPassword = password_hash(
    $password,
    PASSWORD_DEFAULT
);

/* =========================
   INSERT STUDENT
========================= */

$sql = "INSERT INTO students
        (
            first_name,
            last_name,
            sr_code,
            college_id,
            program_id,
            password
        )
        VALUES (?, ?, ?, ?, ?, ?)";

$stmt = $conn->prepare($sql);

$stmt->bind_param(
    "sssiis",
    $first_name,
    $last_name,
    $sr_code,
    $college_id,
    $program_id,
    $hashedPassword
);

/* =========================
   EXECUTE
========================= */

if ($stmt->execute()) {

    echo json_encode([
        "success" => true,
        "message" => "Account created successfully"
    ]);

} else {

    echo json_encode([
        "success" => false,
        "message" => $stmt->error
    ]);
}

$stmt->close();
$conn->close();

?>