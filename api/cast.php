<?php
/**
 * Netflix4U cPanel Native Cast & Crew Resolver
 * Fetches TMDB cast details and actor photos with disk caching
 *
 * SECURITY:
 * - TMDB API key loaded from environment variable (never hardcoded)
 * - CORS restricted to netflix4u.in origin
 * - SSL verification enabled
 * - Basic IP rate limiting
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
header("Cache-Control: public, max-age=86400");
header("X-Content-Type-Options: nosniff");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// --- Rate Limiting (simple IP-based, 60 requests/minute) ---
$rateLimitDir = sys_get_temp_dir() . '/netflix4u_rl';
if (!is_dir($rateLimitDir)) @mkdir($rateLimitDir, 0755, true);
$clientIp = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$rlFile = $rateLimitDir . '/cast_' . md5($clientIp) . '.json';
$rlWindow = 60;
$rlMax = 60;

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
$tmdbId = isset($_GET['tmdbId']) ? trim($_GET['tmdbId']) : '';
$year = isset($_GET['year']) ? trim($_GET['year']) : '';
$type = isset($_GET['type']) ? trim($_GET['type']) : 'movie';
$imdbId = isset($_GET['imdbId']) ? trim($_GET['imdbId']) : '';

$endpoint = in_array($type, ['series', 'anime', 'kdrama', 'tv']) ? 'tv' : 'movie';

// --- TMDB API Key: Load from environment variable ---
$apiKey = getenv('TMDB_API_KEY');
if (empty($apiKey)) {
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

// --- Cache ---
$cacheDir = __DIR__ . '/../data/image_cache';
if (!is_dir($cacheDir)) {
    @mkdir($cacheDir, 0755, true);
}
$cacheKey = md5(strtolower("cast_{$imdbId}_{$tmdbId}_{$title}_{$year}_{$type}"));
$cacheFile = $cacheDir . '/c_' . $cacheKey . '.json';

if (file_exists($cacheFile) && (time() - filemtime($cacheFile) < 604800)) {
    $cached = @file_get_contents($cacheFile);
    if ($cached) {
        echo $cached;
        exit;
    }
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

$targetId = $tmdbId;

// 1. Resolve via IMDb ID if provided
if (empty($targetId) && !empty($imdbId) && strpos($imdbId, 'tt') === 0) {
    $findUrl = "https://api.themoviedb.org/3/find/" . urlencode($imdbId) . "?api_key={$apiKey}&external_source=imdb_id";
    $findRaw = fetchTMDB($findUrl);
    if ($findRaw) {
        $findJson = @json_decode($findRaw, true);
        if ($findJson) {
            $prop = ($endpoint === 'tv') ? 'tv_results' : 'movie_results';
            if (!empty($findJson[$prop][0]['id'])) {
                $targetId = $findJson[$prop][0]['id'];
            } elseif (!empty($findJson['movie_results'][0]['id'])) {
                $targetId = $findJson['movie_results'][0]['id'];
                $endpoint = 'movie';
            } elseif (!empty($findJson['tv_results'][0]['id'])) {
                $targetId = $findJson['tv_results'][0]['id'];
                $endpoint = 'tv';
            }
        }
    }
}

// 2. Resolve via title search
if (empty($targetId) && !empty($title)) {
    $clean = cleanTitle($title);
    if (!empty($clean)) {
        $searchUrl = "https://api.themoviedb.org/3/search/{$endpoint}?api_key={$apiKey}&query=" . urlencode($clean);
        if (!empty($year) && is_numeric($year)) {
            $yearParam = ($endpoint === 'tv') ? 'first_air_date_year' : 'primary_release_year';
            $searchUrl .= "&{$yearParam}=" . urlencode($year);
        }
        $searchRaw = fetchTMDB($searchUrl);
        if ($searchRaw) {
            $searchJson = @json_decode($searchRaw, true);
            if (!empty($searchJson['results'][0]['id'])) {
                $targetId = $searchJson['results'][0]['id'];
            }
        }
        // Fallback: cross-search other type
        if (empty($targetId)) {
            $altEndpoint = ($endpoint === 'tv') ? 'movie' : 'tv';
            $altUrl = "https://api.themoviedb.org/3/search/{$altEndpoint}?api_key={$apiKey}&query=" . urlencode($clean);
            $altRaw = fetchTMDB($altUrl);
            if ($altRaw) {
                $altJson = @json_decode($altRaw, true);
                if (!empty($altJson['results'][0]['id'])) {
                    $targetId = $altJson['results'][0]['id'];
                    $endpoint = $altEndpoint;
                }
            }
        }
    }
}

$castList = [];

if (!empty($targetId)) {
    $creditsUrl = "https://api.themoviedb.org/3/{$endpoint}/" . urlencode($targetId) . "/credits?api_key={$apiKey}";
    $creditsRaw = fetchTMDB($creditsUrl);
    if ($creditsRaw) {
        $creditsJson = @json_decode($creditsRaw, true);
        if (!empty($creditsJson['cast']) && is_array($creditsJson['cast'])) {
            $slice = array_slice($creditsJson['cast'], 0, 15);
            foreach ($slice as $member) {
                $castList[] = [
                    'id' => isset($member['id']) ? $member['id'] : null,
                    'name' => isset($member['name']) ? $member['name'] : 'Actor',
                    'character' => isset($member['character']) ? $member['character'] : '',
                    'photo' => !empty($member['profile_path']) ? 'https://image.tmdb.org/t/p/w185' . $member['profile_path'] : null
                ];
            }
        }
    }
}

$response = json_encode(['success' => true, 'cast' => $castList, 'tmdbId' => $targetId]);
@file_put_contents($cacheFile, $response);
echo $response;
