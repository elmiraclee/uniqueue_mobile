<?php

header("Content-Type: application/json");

include "db.php";


$student_id = intval($_GET['student_id'] ?? 0);


$sql = "

SELECT

s.id,
s.first_name,
s.last_name,
s.sr_code,
s.year_level,

c.name AS college_name,

p.name AS program_name,

s.college_id,
s.program_id


FROM students s


LEFT JOIN colleges c
ON s.college_id = c.id


LEFT JOIN programs p
ON s.program_id = p.id


WHERE s.id = ?

";


$stmt=$conn->prepare($sql);

$stmt->bind_param(
"i",
$student_id
);


$stmt->execute();


$result=$stmt->get_result();


echo json_encode(
[
"success"=>true,
"student"=>$result->fetch_assoc()
]
);


?>