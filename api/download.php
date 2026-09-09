<?php
/**
 * Netflix4U cPanel Universal High-Speed Download Resolver
 * Seamlessly resolves Fast Cloud direct streams on Apache, LiteSpeed, and PHP environments.
 *
 * SECURITY:
 * - CORS restricted to netflix4u.in origin
 * - Input URL validation with domain allowlist
 * - Rate limiting
 * - Path traversal protection on slug lookup
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
header("Cache-Control: no-cache, no-store, must-revalidate");
header("X-Content-Type-Options: nosniff");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// --- Rate Limiting ---
$rateLimitDir = sys_get_temp_dir() . '/netflix4u_rl';
if (!is_dir($rateLimitDir)) @mkdir($rateLimitDir, 0755, true);
$clientIp = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$rlFile = $rateLimitDir . '/dl_' . md5($clientIp) . '.json';
$rlWindow = 60;
$rlMax = 30; // downloads are more expensive, stricter limit

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
    header("Content-Type: text/plain");
    echo "Rate limit exceeded. Try again later.";
    exit;
}

// --- Redirect URL Domain Allowlist ---
$ALLOWED_REDIRECT_DOMAINS = [
    'vcloud.fit',
    'vcloud.lol',
    'workers.dev',
    'nexdrive.site',
    'gofile.io',
    'slast430did.com'
];

function isAllowedRedirectUrl($url) {
    global $ALLOWED_REDIRECT_DOMAINS;
    if (empty($url) || strpos($url, 'http') !== 0) return false;
    $parsed = parse_url($url);
    if (!$parsed || empty($parsed['host'])) return false;
    foreach ($ALLOWED_REDIRECT_DOMAINS as $domain) {
        if ($parsed['host'] === $domain || str_ends_with($parsed['host'], '.' . $domain)) {
            return true;
        }
    }
    return false;
}

$vcloud = isset($_GET['vcloud']) ? trim($_GET['vcloud']) : (isset($_GET['url']) ? trim($_GET['url']) : '');
$slug = isset($_GET['slug']) ? trim($_GET['slug']) : (isset($_GET['id']) ? trim($_GET['id']) : '');

// If slug/id passed without vcloud, attempt reading from data/details
if (empty($vcloud) && !empty($slug)) {
    $cleanSlug = preg_replace('/[^a-zA-Z0-9\-_]/', '', $slug);
    $detailPath = __DIR__ . '/../data/details/' . $cleanSlug . '.json';

    // Path traversal guard
    $resolvedPath = realpath(__DIR__ . '/../data/details/');
    $resolvedTarget = realpath($detailPath);
    if ($resolvedTarget && $resolvedPath && strpos($resolvedTarget, $resolvedPath) === 0) {
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
}

if (empty($vcloud)) {
    header("Location: /", true, 302);
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

// Validate the final URL is from an allowed domain
if (!isAllowedRedirectUrl($cleanVcloud) && strpos($cleanVcloud, 'vcloud') === false) {
    http_response_code(400);
    header("Content-Type: text/plain");
    echo "Invalid download URL.";
    exit;
}

// If already a direct HTTP download link (not vcloud or workers), redirect directly
if (strpos($cleanVcloud, 'vcloud') === false && strpos($cleanVcloud, 'workers.dev') === false && strpos($cleanVcloud, 'http') === 0) {
    if (isAllowedRedirectUrl($cleanVcloud)) {
        header("Location: " . $cleanVcloud, true, 302);
        exit;
    }
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
            'verify_peer' => true,
            'verify_peer_name' => true
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
