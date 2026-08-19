<?php

header("Content-Type: application/json");

include "db.php";

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode([
        "success" => false,
        "message" => "Invalid request."
    ]);
    exit;
}

$student_id = intval($_POST['student_id'] ?? 0);

if ($student_id <= 0) {
    echo json_encode([
        "success" => false,
        "message" => "Invalid student."
    ]);
    exit;
}

if (!isset($_FILES["picture"])) {
    echo json_encode([
        "success" => false,
        "message" => "No image uploaded."
    ]);
    exit;
}

$file = $_FILES["picture"];

if ($file["error"] !== UPLOAD_ERR_OK) {
    echo json_encode([
        "success" => false,
        "message" => "Upload failed."
    ]);
    exit;
}

$allowed = [
    "jpg",
    "jpeg",
    "png",
    "webp"
];

$extension = strtolower(pathinfo($file["name"], PATHINFO_EXTENSION));

if (!in_array($extension, $allowed)) {
    echo json_encode([
        "success" => false,
        "message" => "Invalid image type."
    ]);
    exit;
}

$uploadDir = "uploads/profile/";

if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0777, true);
}

$newFileName = $student_id . "_" . time() . "." . $extension;

$destination = $uploadDir . $newFileName;

if (!move_uploaded_file($file["tmp_name"], $destination)) {
    echo json_encode([
        "success" => false,
        "message" => "Unable to save image."
    ]);
    exit;
}

/*
|--------------------------------------------------------------------------
| Delete old picture (optional)
|--------------------------------------------------------------------------
*/

$stmt = $conn->prepare("SELECT picture FROM students WHERE id=?");
$stmt->bind_param("i", $student_id);
$stmt->execute();

$result = $stmt->get_result();
$row = $result->fetch_assoc();

if (!empty($row["picture"])) {

    $oldFile = $row["picture"];

    if (file_exists($oldFile)) {
        unlink($oldFile);
    }
}

/*
|--------------------------------------------------------------------------
| Save new picture
|--------------------------------------------------------------------------
*/

$stmt = $conn->prepare("
UPDATE students
SET picture=?
WHERE id=?
");

$stmt->bind_param(
    "si",
    $destination,
    $student_id
);

if ($stmt->execute()) {

    echo json_encode([
        "success" => true,
        "picture" => $destination
    ]);

} else {

    echo json_encode([
        "success" => false,
        "message" => "Database update failed."
    ]);

}