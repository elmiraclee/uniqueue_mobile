<?php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

include "db.php";

/* =========================
   GET JSON BODY
========================= */
$raw = file_get_contents("php://input");
$data = json_decode($raw);

if (!$data) {
    echo json_encode([
        "success" => false,
        "message" => "No input received"
    ]);
    exit;
}

$username = trim($data->username ?? '');
$password = trim($data->password ?? '');

if (empty($username) || empty($password)) {
    echo json_encode([
        "success" => false,
        "message" => "Username and password are required"
    ]);
    exit;
}

/* =========================
   1. CHECK STUDENT
========================= */
$sqlStudent = "SELECT * FROM students WHERE sr_code = ?";
$stmt = $conn->prepare($sqlStudent);
$stmt->bind_param("s", $username);
$stmt->execute();

$result = $stmt->get_result();

if ($result->num_rows > 0) {

    $user = $result->fetch_assoc();

    // PASSWORD HASH CHECK
    if (password_verify($password, $user['password'])) {

        unset($user['password']);

        echo json_encode([
            "success" => true,
            "role" => "student",
            "user" => $user
        ]);
        exit;

    } else {

        echo json_encode([
            "success" => false,
            "message" => "Wrong password"
        ]);
        exit;
    }
}

/* =========================
   2. CHECK ADMIN / OFFICE
========================= */
$sqlAdmin = "
    SELECT au.*, o.name
    FROM admin_users au
    LEFT JOIN offices o
        ON au.office_id = o.id
    WHERE au.username = ?
";
$stmt = $conn->prepare($sqlAdmin);
$stmt->bind_param("s", $username);
$stmt->execute();

$result = $stmt->get_result();

if ($result->num_rows > 0) {

    $admin = $result->fetch_assoc();

    if (password_verify($password, $admin['password'])) {

        $role = ($admin['is_super_admin'] == 1)
            ? "admin"
            : "office";

        unset($admin['password']);

        echo json_encode([
            "success" => true,
            "role" => $role,
            "user" => $admin
        ]);
        exit;

    } else {

        echo json_encode([
            "success" => false,
            "message" => "Wrong password"
        ]);
        exit;
    }
}

/* =========================
   USER NOT FOUND
========================= */
echo json_encode([
    "success" => false,
    "message" => "User not found"
]);