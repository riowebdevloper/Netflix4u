<?php
header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
echo json_encode([
    "status" => "ok",
    "service" => "Netflix4U cPanel Engine",
    "timestamp" => date("c")
]);
