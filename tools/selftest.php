<?php
/**
 * THROWAWAY. Answers, in one page load, every open question about whether audit.php can work on a given host.
 *
 * This file is deliberately NOT in a site's public/ directory, so no deploy ever ships it. Upload it by hand,
 * load it once, paste the output into docs/DECISIONS.md, delete it.
 *
 *   1. Set a key below (any random string).
 *   2. Upload to the docroot as selftest.php.
 *   3. Load https://your-domain/selftest.php?key=YOUR_KEY   (from a phone on cellular as well as the office —
 *      if REMOTE_ADDR is the same from both, the host is behind a proxy and the rate limiter is per-proxy).
 *   4. Copy the JSON. DELETE THE FILE.
 *
 * It reports server internals, which is why it is keyed and why it is temporary. It fetches exactly one
 * harmless URL and changes nothing.
 */

declare(strict_types=1);

const KEY = 'CHANGE-ME-BEFORE-UPLOADING';
const PROBE_URL = 'https://api.wordpress.org/core/version-check/1.7/';   // public, tiny, and useful to us anyway

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex');

if (KEY === 'CHANGE-ME-BEFORE-UPLOADING' || ($_GET['key'] ?? '') !== KEY) {
    http_response_code(404);
    echo json_encode(['error' => 'not found']);
    exit;
}

$out = [];

/* ---- 1. Does PHP run here at all, and is it new enough? ---- */
// If you are reading raw source instead of JSON, PHP is not enabled on this docroot. That is answer enough.
$out['php'] = [
    'version'     => PHP_VERSION,
    'version_id'  => PHP_VERSION_ID,
    'new_enough'  => PHP_VERSION_ID >= 80100,   // audit.php uses 8.1 syntax
    'sapi'        => PHP_SAPI,
    'max_execution_time' => ini_get('max_execution_time'),
    'memory_limit'       => ini_get('memory_limit'),
    'disabled_functions' => ini_get('disable_functions'),
    'open_basedir'       => ini_get('open_basedir'),
];

/* ---- 2. Is curl there, and does it have what the fetcher needs? ---- */
$out['curl'] = ['loaded' => extension_loaded('curl')];
if (extension_loaded('curl')) {
    $v = curl_version();
    $out['curl'] += [
        'version'    => $v['version'] ?? null,
        'ssl'        => $v['ssl_version'] ?? null,
        'protocols'  => implode(',', array_slice($v['protocols'] ?? [], 0, 12)),
        'has_resolve'=> defined('CURLOPT_RESOLVE'),   // the address pin depends on this
    ];
}

/* ---- 3. Is outbound traffic proxied? A proxy resolves names itself and voids the address pin. ---- */
$out['proxy'] = [
    'http_proxy'  => getenv('http_proxy') ?: getenv('HTTP_PROXY') ?: null,
    'https_proxy' => getenv('https_proxy') ?: getenv('HTTPS_PROXY') ?: null,
    'all_proxy'   => getenv('all_proxy') ?: getenv('ALL_PROXY') ?: null,
];

/* ---- 4. Can we resolve a name ourselves? ---- */
$host = parse_url(PROBE_URL, PHP_URL_HOST);
$out['dns'] = [
    'gethostbynamel' => function_exists('gethostbynamel') ? (@gethostbynamel($host) ?: false) : 'missing',
    'dns_get_record' => function_exists('dns_get_record') ? 'available' : 'missing',
];

/* ---- 5. THE question: can this server fetch a website at all? ---- */
$out['outbound'] = ['attempted' => PROBE_URL];
if (extension_loaded('curl')) {
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL            => PROBE_URL,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT        => 10,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_PROXY          => '',            // same as audit.php: ignore any environment proxy
        CURLOPT_USERAGENT      => 'createawebsite.ca selftest',
    ]);
    $body = curl_exec($ch);
    $out['outbound'] += [
        'ok'         => $body !== false,
        'status'     => (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE),
        'peer_ip'    => curl_getinfo($ch, CURLINFO_PRIMARY_IP),   // must match one of the dns answers above
        'total_time' => round((float) curl_getinfo($ch, CURLINFO_TOTAL_TIME), 3),
        'bytes'      => $body === false ? 0 : strlen($body),
        'error'      => curl_error($ch) ?: null,
    ];
    curl_close($ch);
} else {
    $out['outbound']['ok'] = false;
    $out['outbound']['error'] = 'curl not loaded';
}

/* ---- 6. Where can the rate limiter keep its counter? It currently FAILS OPEN if this is false. ---- */
$tmp = sys_get_temp_dir();
$probeFile = $tmp . '/caw-selftest-' . bin2hex(random_bytes(4));
$wrote = @file_put_contents($probeFile, 'x') !== false;
if ($wrote) { @unlink($probeFile); }
$home = dirname(__DIR__);
$out['storage'] = [
    'sys_temp_dir'          => $tmp,
    'sys_temp_writable'     => $wrote,
    'docroot_parent'        => $home,
    'docroot_parent_writable' => is_writable($home),
];

/* ---- 7. Who does the server think the visitor is? ---- */
// Load this from two different networks. Same value both times means every visitor shares one rate-limit
// bucket, and the 13th genuine prospect in ten minutes gets told to wait.
$out['client'] = [
    'REMOTE_ADDR'        => $_SERVER['REMOTE_ADDR'] ?? null,
    'X-Forwarded-For'    => $_SERVER['HTTP_X_FORWARDED_FOR'] ?? null,
    'CF-Connecting-IP'   => $_SERVER['HTTP_CF_CONNECTING_IP'] ?? null,
    'X-Forwarded-Proto'  => $_SERVER['HTTP_X_FORWARDED_PROTO'] ?? null,   // decides the .htaccess HTTPS rule
    'HTTPS'              => $_SERVER['HTTPS'] ?? null,
    'SERVER_SOFTWARE'    => $_SERVER['SERVER_SOFTWARE'] ?? null,
];

/* ---- verdict ---- */
$canWork = $out['php']['new_enough']
    && ($out['curl']['loaded'] ?? false)
    && ($out['outbound']['ok'] ?? false);
$out['verdict'] = [
    'audit_php_can_work' => $canWork,
    'notes' => array_values(array_filter([
        $out['php']['new_enough'] ? null : 'PHP is too old for audit.php (needs 8.1+).',
        ($out['curl']['loaded'] ?? false) ? null : 'The curl extension is missing; the fetcher cannot run.',
        ($out['outbound']['ok'] ?? false) ? null : 'This server could not reach the open internet. That is fatal for the site check.',
        ($out['proxy']['http_proxy'] || $out['proxy']['https_proxy']) ? 'An environment proxy is set. audit.php overrides it, but confirm outbound still works.' : null,
        $out['storage']['sys_temp_writable'] ? null : 'The temp dir is not writable: the rate limiter would fail open. Move its counter to the docroot parent.',
        ($out['client']['X-Forwarded-For'] || $out['client']['CF-Connecting-IP']) ? 'A proxy is in front of PHP: REMOTE_ADDR is not the visitor, so the rate limiter needs the forwarded header.' : null,
        ($out['client']['HTTPS'] ?? null) ? null : 'Apache does not see HTTPS=on. The .htaccess HTTPS rule must test X-Forwarded-Proto or the site will redirect to itself forever.',
    ])),
];

echo json_encode($out, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
