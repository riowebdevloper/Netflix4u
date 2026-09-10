<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: public, max-age=86400');

$tmdbApiKey = getenv('TMDB_API_KEY') ?: '445f2b5a8941c1d4bd5a869761a916e3';
$title = isset($_GET['title']) ? trim($_GET['title']) : '';
$tmdbId = isset($_GET['tmdbId']) ? trim($_GET['tmdbId']) : '';
$type = isset($_GET['type']) ? trim($_GET['type']) : 'movie';
$cleanType = ($type === 'series' || $type === 'anime' || $type === 'kdrama' || $type === 'tv') ? 'tv' : 'movie';

if (!$title && !$tmdbId) {
    echo json_encode(['error' => 'Missing title or tmdbId', 'trailerUrl' => null]);
    exit;
}

function fetch_json($url) {
    $ctx = stream_context_create([
        'http' => [
            'timeout' => 5,
            'header' => "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)\r\nAccept: application/json\r\n"
        ],
        'ssl' => [
            'verify_peer' => true,
            'verify_peer_name' => true
        ]
    ]);
    $res = @file_get_contents($url, false, $ctx);
    if (!$res) return null;
    return json_decode($res, true);
}

function cleanTitle($t) {
    $t = preg_replace('/&#039;|&apos;|&quot;|&amp;/', ' ', $t);
    $t = preg_replace('/\[[^\]]*\]|\([^\)]*\)|\{[^\}]*\}/', ' ', $t);
    $t = preg_replace('/\b(?:Season\s*\d+|S\d{1,2}|Ep(?:isode)?\s*\d+|All\s*Episodes?|Complete\s*Season).*$/i', '', $t);
    $t = preg_replace('/\b(19\d{2}|20\d{2})\b.*$/i', '', $t);
    $t = preg_replace('/\b(?:Hindi|English|Tamil|Telugu|Malayalam|Kannada|Korean|Japanese|Dual|Audio|Dubbed|Web|FHD|HD|4K|HQ).*$/i', '', $t);
    return trim(preg_replace('/\s+/', ' ', $t));
}

function extract_youtube_trailer($videos) {
    if (empty($videos) || !is_array($videos)) return null;
    $ytVideos = [];
    foreach ($videos as $v) {
        if (!empty($v['site']) && strtolower($v['site']) === 'youtube' && !empty($v['key'])) {
            $ytVideos[] = $v;
        }
    }
    if (empty($ytVideos)) return null;

    // Prefer official trailer > any trailer > teaser > first video
    foreach ($ytVideos as $v) {
        if (!empty($v['type']) && $v['type'] === 'Trailer' && !empty($v['official'])) {
            return $v;
        }
    }
    foreach ($ytVideos as $v) {
        if (!empty($v['type']) && $v['type'] === 'Trailer') {
            return $v;
        }
    }
    foreach ($ytVideos as $v) {
        if (!empty($v['type']) && $v['type'] === 'Teaser') {
            return $v;
        }
    }
    return $ytVideos[0];
}

// 1. If tmdbId provided, query videos directly
if ($tmdbId && is_numeric($tmdbId)) {
    $vidUrl = "https://api.tmdb.org/3/{$cleanType}/{$tmdbId}/videos?api_key={$tmdbApiKey}";
    $data = fetch_json($vidUrl);
    $trailer = extract_youtube_trailer($data['results'] ?? null);
    if (!$trailer) {
        // Fallback to alternate endpoint if wrong type was passed
        $altType = ($cleanType === 'tv') ? 'movie' : 'tv';
        $altVidUrl = "https://api.tmdb.org/3/{$altType}/{$tmdbId}/videos?api_key={$tmdbApiKey}";
        $altData = fetch_json($altVidUrl);
        $trailer = extract_youtube_trailer($altData['results'] ?? null);
    }
    if ($trailer && !empty($trailer['key'])) {
        echo json_encode([
            'success' => true,
            'trailerUrl' => "https://www.youtube-nocookie.com/embed/" . $trailer['key'] . "?rel=0&modestbranding=1",
            'key' => $trailer['key'],
            'name' => $trailer['name'] ?? '',
            'state' => 'ready'
        ]);
        exit;
    }
}

// 2. Search TMDB by clean title if tmdbId missing or had no video
if ($title) {
    $clean = cleanTitle($title);
    if (!empty($clean)) {
        $searchUrl = "https://api.tmdb.org/3/search/{$cleanType}?api_key={$tmdbApiKey}&query=" . urlencode($clean);
        $data = fetch_json($searchUrl);
        $foundId = $data['results'][0]['id'] ?? null;

        if (!$foundId) {
            $altType = ($cleanType === 'tv') ? 'movie' : 'tv';
            $altSearchUrl = "https://api.tmdb.org/3/search/{$altType}?api_key={$tmdbApiKey}&query=" . urlencode($clean);
            $altData = fetch_json($altSearchUrl);
            $foundId = $altData['results'][0]['id'] ?? null;
            if ($foundId) $cleanType = $altType;
        }

        if ($foundId) {
            $vidUrl = "https://api.tmdb.org/3/{$cleanType}/{$foundId}/videos?api_key={$tmdbApiKey}";
            $vData = fetch_json($vidUrl);
            $trailer = extract_youtube_trailer($vData['results'] ?? null);
            if ($trailer && !empty($trailer['key'])) {
                echo json_encode([
                    'success' => true,
                    'trailerUrl' => "https://www.youtube-nocookie.com/embed/" . $trailer['key'] . "?rel=0&modestbranding=1",
                    'key' => $trailer['key'],
                    'name' => $trailer['name'] ?? '',
                    'state' => 'ready'
                ]);
                exit;
            }
        }
    }
}

// 3. If no official YouTube trailer found, cleanly return null (never return deprecated search embed)
echo json_encode([
    'success' => false,
    'trailerUrl' => null,
    'state' => 'unavailable',
    'searchUrl' => "https://www.youtube.com/results?search_query=" . urlencode(($clean ?? $title) . " official trailer")
]);
