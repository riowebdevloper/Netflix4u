<?php
/**
 * Netflix4U cPanel Universal High-Speed Download Resolver
 * Seamlessly resolves Fast Cloud direct streams on Apache, LiteSpeed, and PHP environments.
 */

// Enable CORS and disable cache on dynamic redirect
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Cache-Control: no-cache, no-store, must-revalidate");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$vcloud = isset($_GET['vcloud']) ? trim($_GET['vcloud']) : (isset($_GET['url']) ? trim($_GET['url']) : '');
$slug = isset($_GET['slug']) ? trim($_GET['slug']) : (isset($_GET['id']) ? trim($_GET['id']) : '');

// If slug/id passed without vcloud, attempt reading from data/details
if (empty($vcloud) && !empty($slug)) {
    $cleanSlug = preg_replace('/[^a-zA-Z0-9\-_]/', '', $slug);
    $detailPath = __DIR__ . '/../data/details/' . $cleanSlug . '.json';
    if (file_exists($detailPath)) {
        $detailData = @json_decode(file_get_contents($detailPath), true);
        if ($detailData && isset($detailData['links']) && is_array($detailData['links'])) {
            foreach ($detailData['links'] as $lnk) {
                if (isset($lnk['url']) && !empty($lnk['url'])) {
                    $vcloud = $lnk['url'];
                    break;
                }
            }
        }
    }
}

if (empty($vcloud)) {
    header("Location: https://netflix4u.fun/", true, 302);
    exit;
}

// Clean vcloud parameter recursively
$cleanVcloud = $vcloud;
while (strpos($cleanVcloud, 'vcloud=') !== false) {
    if (preg_match('/vcloud=([^&]+)/', $cleanVcloud, $matches)) {
        $cleanVcloud = urldecode($matches[1]);
    } else {
        break;
    }
}

// If already a direct HTTP download link (not vcloud or workers), redirect directly
if (strpos($cleanVcloud, 'vcloud') === false && strpos($cleanVcloud, 'workers.dev') === false && strpos($cleanVcloud, 'http') === 0) {
    header("Location: " . $cleanVcloud, true, 302);
    exit;
}

$workerHosts = [
    'https://wild-sun-9376.oriue.workers.dev',
    'https://crimson-sea-a1e5.hekoy.workers.dev'
];

$fallbackUrl = $workerHosts[0] . '/?vcloud=' . urlencode($cleanVcloud);

foreach ($workerHosts as $host) {
    $apiUrl = $host . '/api/links?vcloud=' . urlencode($cleanVcloud);
    
    $ctx = stream_context_create([
        'http' => [
            'timeout' => 4,
            'header'  => "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)\r\n" .
                         "Accept: application/json\r\n"
        ],
        'ssl' => [
            'verify_peer' => false,
            'verify_peer_name' => false
        ]
    ]);

    $raw = @file_get_contents($apiUrl, false, $ctx);
    if ($raw !== false) {
        $json = @json_decode($raw, true);
        if ($json && isset($json['tokens']) && is_array($json['tokens'])) {
            $preferred = ['fsl', 'fsl2', 'server1', 'ten', 'gofile'];
            $type = null;
            foreach ($preferred as $p) {
                if (isset($json['tokens'][$p])) {
                    $type = $p;
                    break;
                }
            }
            if (!$type) {
                foreach ($json['tokens'] as $k => $v) {
                    if ($k !== 'pixel') {
                        $type = $k;
                        break;
                    }
                }
            }

            if ($type) {
                $tok = $json['tokens'][$type];
                $goUrl = $host . '/go?type=' . $type . '&vcloud=' . urlencode($cleanVcloud) . '&ts=' . $tok['ts'] . '&sig=' . $tok['sig'];

                // Attempt to resolve direct R2 redirect location
                $headers = @get_headers($goUrl, 1, $ctx);
                if ($headers && isset($headers['Location'])) {
                    $loc = is_array($headers['Location']) ? end($headers['Location']) : $headers['Location'];
                    if (!empty($loc)) {
                        header("Location: " . $loc, true, 302);
                        exit;
                    }
                }

                header("Location: " . $goUrl, true, 302);
                exit;
            }
        }
    }
}

// Fallback to worker UI
header("Location: " . $fallbackUrl, true, 302);
exit;
