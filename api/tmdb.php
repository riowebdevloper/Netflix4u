<?php
/**
 * Netflix4U TMDB API Server Proxy with Local ID Mapping and Disk Caching
 * Protects TMDB API key from client exposure and maps catalog IDs to real TMDB IDs
 */

$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
$allowedOrigins = [
    'https://netflix4u.in',
    'https://www.netflix4u.in',
    'http://localhost:4173',
    'http://localhost:3000'
];
if (in_array($origin, $allowedOrigins)) {
    header("Access-Control-Allow-Origin: " . $origin);
} else {
    header("Access-Control-Allow-Origin: https://netflix4u.in");
}
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: public, max-age=3600");
header("X-Content-Type-Options: nosniff");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$endpoint = isset($_GET['endpoint']) ? trim($_GET['endpoint']) : '';
if (empty($endpoint)) {
    $uri = $_SERVER['REQUEST_URI'] ?? '';
    if (preg_match('#/api/tmdb/(.+?)(\?|$)#', $uri, $m)) {
        $endpoint = $m[1];
    }
}
$endpoint = ltrim($endpoint, '/');

if (empty($endpoint)) {
    http_response_code(400);
    echo json_encode(['error' => 'Endpoint missing']);
    exit;
}

// Load TMDB API Key
$apiKey = getenv('TMDB_API_KEY');
if (empty($apiKey)) {
    $envFile = __DIR__ . '/../.env';
    if (file_exists($envFile)) {
        $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        foreach ($lines as $line) {
            if (strpos($line, 'TMDB_API_KEY=') === 0) {
                $apiKey = trim(substr($line, strlen('TMDB_API_KEY=')));
                break;
            }
        }
    }
}
if (empty($apiKey)) {
    $apiKey = '445f2b5a8941c1d4bd5a869761a916e3';
}

// Disk cache
$cacheDir = __DIR__ . '/../data/image_cache';
if (!is_dir($cacheDir)) @mkdir($cacheDir, 0755, true);

// Local ID -> TMDB ID mapping
if (preg_match('#^(tv|movie)/(\d+)(.*)$#', $endpoint, $m)) {
    $mediaType = $m[1];
    $id = $m[2];
    $rest = $m[3];

    // Check if details file exists for this local id
    $detailsFile = __DIR__ . "/../data/details/{$id}.json";
    if (file_exists($detailsFile)) {
        $detailData = @json_decode(file_get_contents($detailsFile), true);
        if (!empty($detailData['tmdbId'])) {
            $endpoint = "{$mediaType}/{$detailData['tmdbId']}{$rest}";
        } else if (!empty($detailData['title'])) {
            $cleanTitle = trim(preg_replace('/\(\d{4}\)/', '', $detailData['title']));
            $sUrl = "https://api.tmdb.org/3/search/{$mediaType}?api_key={$apiKey}&query=" . urlencode($cleanTitle);
            $sRaw = @file_get_contents($sUrl);
            if ($sRaw) {
                $sJson = @json_decode($sRaw, true);
                if (!empty($sJson['results'][0]['id'])) {
                    $foundTmdbId = $sJson['results'][0]['id'];
                    $endpoint = "{$mediaType}/{$foundTmdbId}{$rest}";
                }
            }
        }
    }
}

// Build TMDB Target URL
$queryParams = $_GET;
unset($queryParams['endpoint']);
unset($queryParams['api_key']);
$queryParams['api_key'] = $apiKey;

$queryString = http_build_query($queryParams);
$cacheKey = md5("tmdb_{$endpoint}_{$queryString}");
$cacheFile = "{$cacheDir}/tmdb_{$cacheKey}.json";

if (file_exists($cacheFile) && (time() - filemtime($cacheFile) < 3600)) {
    $cached = @file_get_contents($cacheFile);
    if ($cached) {
        echo $cached;
        exit;
    }
}

$targetUrl = "https://api.tmdb.org/3/{$endpoint}?{$queryString}";

$ctx = stream_context_create([
    'http' => [
        'timeout' => 6,
        'header' => "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)\r\nAccept: application/json\r\n"
    ],
    'ssl' => [
        'verify_peer' => true,
        'verify_peer_name' => true
    ]
]);

$response = @file_get_contents($targetUrl, false, $ctx);
if ($response === false) {
    http_response_code(502);
    echo json_encode(['error' => 'Failed to reach TMDB API']);
    exit;
}

@file_put_contents($cacheFile, $response);
echo $response;
