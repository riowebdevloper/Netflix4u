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
            'timeout' => 4,
            'header' => "User-Agent: Netflix4u/1.0\r\nAccept: application/json\r\n"
        ]
    ]);
    $res = @file_get_contents($url, false, $ctx);
    if (!$res) return null;
    return json_decode($res, true);
}

// 1. If tmdbId provided, query videos directly
if ($tmdbId) {
    $vidUrl = "https://api.themoviedb.org/3/{$cleanType}/{$tmdbId}/videos?api_key={$tmdbApiKey}";
    $data = fetch_json($vidUrl);
    if (!empty($data['results'])) {
        $trailer = null;
        foreach ($data['results'] as $v) {
            if ($v['site'] === 'YouTube' && ($v['type'] === 'Trailer' || $v['type'] === 'Teaser')) {
                $trailer = $v;
                if ($v['type'] === 'Trailer') break;
            }
        }
        if ($trailer && !empty($trailer['key'])) {
            echo json_encode([
                'trailerUrl' => "https://www.youtube-nocookie.com/embed/" . $trailer['key'] . "?rel=0&modestbranding=1",
                'key' => $trailer['key'],
                'name' => $trailer['name'] ?? ''
            ]);
            exit;
        }
    }
}

// 2. Search TMDB if title provided
if ($title) {
    $cleanTitle = preg_replace('/\(\d{4}\)/', '', $title);
    $cleanTitle = trim($cleanTitle);
    $searchUrl = "https://api.themoviedb.org/3/search/{$cleanType}?api_key={$tmdbApiKey}&query=" . urlencode($cleanTitle);
    $data = fetch_json($searchUrl);
    if (!empty($data['results'][0]['id'])) {
        $foundId = $data['results'][0]['id'];
        $vidUrl = "https://api.themoviedb.org/3/{$cleanType}/{$foundId}/videos?api_key={$tmdbApiKey}";
        $vData = fetch_json($vidUrl);
        if (!empty($vData['results'])) {
            $trailer = null;
            foreach ($vData['results'] as $v) {
                if ($v['site'] === 'YouTube' && ($v['type'] === 'Trailer' || $v['type'] === 'Teaser')) {
                    $trailer = $v;
                    if ($v['type'] === 'Trailer') break;
                }
            }
            if ($trailer && !empty($trailer['key'])) {
                echo json_encode([
                    'trailerUrl' => "https://www.youtube-nocookie.com/embed/" . $trailer['key'] . "?rel=0&modestbranding=1",
                    'key' => $trailer['key'],
                    'name' => $trailer['name'] ?? ''
                ]);
                exit;
            }
        }
    }
}

echo json_encode([
    'trailerUrl' => null,
    'searchUrl' => "https://www.youtube.com/results?search_query=" . urlencode($title . " official trailer")
]);
