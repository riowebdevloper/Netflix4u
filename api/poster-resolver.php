<?php
/**
 * Netflix4U cPanel Native Poster & Backdrop Resolver
 * Fetches TMDB high-res posters and backdrops with disk caching
 *
 * SECURITY:
 * - TMDB API key loaded from environment variable (never hardcoded)
 * - CORS restricted to netflix4u.in origin
 * - SSL verification enabled
 * - Basic IP rate limiting
 * - Poster URL domain allowlist enforced
 */

// --- CORS: Restrict to own domain ---
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
header("Cache-Control: public, max-age=604800");
header("X-Content-Type-Options: nosniff");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// --- Rate Limiting (simple IP-based, 60 requests/minute) ---
$rateLimitDir = sys_get_temp_dir() . '/netflix4u_rl';
if (!is_dir($rateLimitDir)) @mkdir($rateLimitDir, 0755, true);
$clientIp = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$rlFile = $rateLimitDir . '/pr_' . md5($clientIp) . '.json';
$rlWindow = 60; // seconds
$rlMax = 60;    // max requests per window

$rlData = ['count' => 0, 'start' => time()];
if (file_exists($rlFile)) {
    $rlData = @json_decode(file_get_contents($rlFile), true) ?: $rlData;
}
if (time() - $rlData['start'] > $rlWindow) {
    $rlData = ['count' => 0, 'start' => time()];
}
$rlData['count']++;
@file_put_contents($rlFile, json_encode($rlData));

if ($rlData['count'] > $rlMax) {
    http_response_code(429);
    echo json_encode(['error' => 'Rate limit exceeded. Try again later.']);
    exit;
}

// --- Input ---
$title = isset($_GET['title']) ? trim($_GET['title']) : '';
$imdbId = isset($_GET['imdbId']) ? trim($_GET['imdbId']) : '';
$type = isset($_GET['type']) ? trim($_GET['type']) : 'movie';

$endpoint = in_array($type, ['series', 'anime', 'kdrama', 'tv']) ? 'tv' : 'movie';

// --- TMDB API Key: Load from environment variable ---
$apiKey = getenv('TMDB_API_KEY');
if (empty($apiKey)) {
    // Fallback: try reading from .env file in project root
    $envFile = __DIR__ . '/../.env';
    if (file_exists($envFile)) {
        $envLines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        foreach ($envLines as $line) {
            if (strpos($line, '#') === 0) continue;
            if (strpos($line, 'TMDB_API_KEY=') === 0) {
                $apiKey = trim(substr($line, strlen('TMDB_API_KEY=')));
                break;
            }
        }
    }
}
if (empty($apiKey)) {
    http_response_code(500);
    echo json_encode(['error' => 'Server configuration error: TMDB API key not set']);
    exit;
}

// --- Disk Cache ---
$cacheDir = __DIR__ . '/../data/image_cache';
if (!is_dir($cacheDir)) {
    @mkdir($cacheDir, 0755, true);
}
$cacheKey = md5(strtolower("poster_{$imdbId}_{$title}_{$type}"));
$cacheFile = $cacheDir . '/p_' . $cacheKey . '.json';

if (file_exists($cacheFile) && (time() - filemtime($cacheFile) < 1209600)) {
    $cached = @file_get_contents($cacheFile);
    if ($cached) {
        echo $cached;
        exit;
    }
}

// --- Poster URL Domain Allowlist ---
$ALLOWED_POSTER_DOMAINS = [
    'image.tmdb.org',
    'storage.hicine.sbs',
    'i.imgur.com'
];

function isAllowedPosterUrl($url) {
    global $ALLOWED_POSTER_DOMAINS;
    if (empty($url)) return false;
    $parsed = parse_url($url);
    if (!$parsed || empty($parsed['host'])) return false;
    foreach ($ALLOWED_POSTER_DOMAINS as $domain) {
        if ($parsed['host'] === $domain || str_ends_with($parsed['host'], '.' . $domain)) {
            return true;
        }
    }
    return false;
}

function fetchTMDB($url) {
    $ctx = stream_context_create([
        'http' => [
            'timeout' => 5,
            'header'  => "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)\r\n" .
                         "Accept: application/json\r\n"
        ],
        'ssl' => [
            'verify_peer' => true,
            'verify_peer_name' => true
        ]
    ]);
    return @file_get_contents($url, false, $ctx);
}

function cleanTitle($t) {
    $t = preg_replace('/&#039;|&apos;|&quot;|&amp;/', ' ', $t);
    $t = preg_replace('/\[[^\]]*\]|\([^\)]*\)|\{[^\}]*\}/', ' ', $t);
    $t = preg_replace('/\b(?:Season\s*\d+|S\d{1,2}|Ep(?:isode)?\s*\d+|All\s*Episodes?|Complete\s*Season).*$/i', '', $t);
    $t = preg_replace('/\b(19\d{2}|20\d{2})\b.*$/i', '', $t);
    $t = preg_replace('/\b(?:Hindi|English|Tamil|Telugu|Dual|Audio|Dubbed|Web|FHD|HD|4K).*$/i', '', $t);
    return trim(preg_replace('/\s+/', ' ', $t));
}

$poster = null;
$backdrop = null;

// 1. If IMDb ID is available, try /find
if (!empty($imdbId) && strpos($imdbId, 'tt') === 0) {
    $findUrl = "https://api.themoviedb.org/3/find/" . urlencode($imdbId) . "?api_key={$apiKey}&external_source=imdb_id";
    $findRaw = fetchTMDB($findUrl);
    if ($findRaw) {
        $findJson = @json_decode($findRaw, true);
        if ($findJson) {
            $item = !empty($findJson['movie_results'][0]) ? $findJson['movie_results'][0] : (!empty($findJson['tv_results'][0]) ? $findJson['tv_results'][0] : null);
            if ($item) {
                $candidatePoster = !empty($item['poster_path']) ? 'https://image.tmdb.org/t/p/w500' . $item['poster_path'] : null;
                $candidateBackdrop = !empty($item['backdrop_path']) ? 'https://image.tmdb.org/t/p/original' . $item['backdrop_path'] : null;
                if (isAllowedPosterUrl($candidatePoster)) $poster = $candidatePoster;
                if (isAllowedPosterUrl($candidateBackdrop)) $backdrop = $candidateBackdrop;
            }
        }
    }
}

// 2. If no poster yet, search by title
if (empty($poster) && !empty($title)) {
    $clean = cleanTitle($title);
    if (!empty($clean)) {
        $searchUrl = "https://api.themoviedb.org/3/search/{$endpoint}?api_key={$apiKey}&query=" . urlencode($clean);
        $searchRaw = fetchTMDB($searchUrl);
        if ($searchRaw) {
            $searchJson = @json_decode($searchRaw, true);
            if (!empty($searchJson['results'][0])) {
                $item = $searchJson['results'][0];
                $candidatePoster = !empty($item['poster_path']) ? 'https://image.tmdb.org/t/p/w500' . $item['poster_path'] : null;
                $candidateBackdrop = !empty($item['backdrop_path']) ? 'https://image.tmdb.org/t/p/original' . $item['backdrop_path'] : null;
                if (isAllowedPosterUrl($candidatePoster)) $poster = $candidatePoster;
                if (isAllowedPosterUrl($candidateBackdrop)) $backdrop = $candidateBackdrop;
            }
        }
    }
}

$resp = json_encode([
    'success' => !empty($poster),
    'poster' => $poster,
    'backdrop' => $backdrop ?: $poster
]);
@file_put_contents($cacheFile, $resp);
echo $resp;
