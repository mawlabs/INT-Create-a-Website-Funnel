<?php
/**
 * Site audit fetcher for createawebsite.ca.
 *
 * The site itself is static; this is the one server-side piece, because a browser cannot read another origin's
 * pages or response headers. It fetches a visitor-supplied URL and returns a snapshot (status, headers, HTML and
 * a few probes) as JSON. All analysis happens in the browser — see packages/lander-kit/lib/audit.ts.
 *
 * A fetcher that takes a URL from the public is an SSRF hazard, so this one:
 *   - accepts http and https only, on the default ports;
 *   - resolves the host itself and refuses private, loopback, link-local and reserved addresses;
 *   - pins the connection to the address it validated, so DNS cannot change under it (rebinding);
 *   - follows redirects by hand, re-validating every hop;
 *   - caps the response size and the total time, and sends no cookies or credentials;
 *   - rate-limits per IP address.
 *
 * Requires PHP 8 with curl. TODO(angelique): confirm PHP is enabled for the docroot in SiteGround Site Tools.
 */

declare(strict_types=1);

const MAX_BYTES        = 1500000;   // 1.5 MB of HTML is plenty; anything larger is itself a finding
const MAX_PROBE_BYTES  = 60000;
const CONNECT_TIMEOUT  = 5;
const TOTAL_TIMEOUT    = 10;
const MAX_REDIRECTS    = 4;
const RATE_LIMIT       = 12;        // scans
const RATE_WINDOW      = 600;       // per 10 minutes, per IP
const USER_AGENT       = 'Mozilla/5.0 (compatible; createawebsite.ca site check; +https://createawebsite.ca/)';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');

function fail(string $code, int $status = 400, array $extra = []): never {
    http_response_code($status);
    echo json_encode(['ok' => false, 'error' => $code] + $extra, JSON_UNESCAPED_SLASHES);
    exit;
}

/* ----------------------------------------------------------------- input */

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    fail('method_not_allowed', 405);
}

$raw = file_get_contents('php://input') ?: '';
$body = json_decode($raw, true);
$input = is_array($body) ? ($body['url'] ?? '') : '';
if (!is_string($input) || $input === '') {
    fail('url_required');
}
$input = trim($input);
if (preg_match('#^([a-z][a-z0-9+.-]*):#i', $input, $scheme)) {
    // A scheme was given: it has to be one we fetch. Never rewrite it into an https URL.
    if (!in_array(strtolower($scheme[1]), ['http', 'https'], true)) {
        fail('url_scheme');
    }
} else {
    $input = 'https://' . ltrim($input, '/');
}
if (strlen($input) > 2000) {
    fail('url_too_long');
}

/* ------------------------------------------------------------ rate limit */

function client_ip(): string {
    $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    return is_string($ip) ? $ip : '0.0.0.0';
}

function rate_limited(): bool {
    $file = sys_get_temp_dir() . '/caw-audit-' . hash('sha256', client_ip()) . '.json';
    $now = time();
    $handle = @fopen($file, 'c+');
    if ($handle === false) {
        return false; // cannot track: let it through rather than break the tool
    }
    try {
        if (!flock($handle, LOCK_EX)) {
            return false;
        }
        $contents = stream_get_contents($handle) ?: '[]';
        $hits = json_decode($contents, true);
        $hits = is_array($hits) ? $hits : [];
        $hits = array_values(array_filter($hits, static fn ($t) => is_int($t) && $t > $now - RATE_WINDOW));
        if (count($hits) >= RATE_LIMIT) {
            return true;
        }
        $hits[] = $now;
        ftruncate($handle, 0);
        rewind($handle);
        fwrite($handle, json_encode($hits));
        return false;
    } finally {
        flock($handle, LOCK_UN);
        fclose($handle);
    }
}

if (rate_limited()) {
    fail('rate_limited', 429);
}

/* --------------------------------------------------------- URL validation */

/** Public, routable address? Rejects private, loopback, link-local, multicast and reserved ranges. */
function is_public_ip(string $ip): bool {
    return filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) !== false;
}

/** Every address the host resolves to, or the literal itself when the host is already an address. */
function resolve_host(string $host): array {
    if (filter_var($host, FILTER_VALIDATE_IP) !== false) {
        return [$host];
    }
    $ips = [];
    $v4 = @gethostbynamel($host);
    if (is_array($v4)) {
        $ips = $v4;
    }
    $v6 = @dns_get_record($host, DNS_AAAA);
    if (is_array($v6)) {
        foreach ($v6 as $record) {
            if (!empty($record['ipv6'])) {
                $ips[] = $record['ipv6'];
            }
        }
    }
    return array_values(array_unique($ips));
}

/**
 * Validate a URL and return [normalized url, host, port, pinned ip].
 * Rejects anything that is not a public http(s) endpoint on a default port.
 */
function check_url(string $url): array {
    $parts = parse_url($url);
    if ($parts === false || empty($parts['host'])) {
        fail('url_invalid');
    }
    $scheme = strtolower($parts['scheme'] ?? '');
    if ($scheme !== 'http' && $scheme !== 'https') {
        fail('url_scheme');
    }
    if (!empty($parts['user']) || !empty($parts['pass'])) {
        fail('url_invalid');
    }
    $host = $parts['host'];
    $port = (int) ($parts['port'] ?? ($scheme === 'https' ? 443 : 80));
    if ($port !== 80 && $port !== 443) {
        fail('url_port');
    }
    if (str_ends_with(strtolower($host), '.local') || !str_contains($host, '.')) {
        fail('url_private');
    }
    $ips = resolve_host($host);
    if ($ips === []) {
        fail('dns_failed', 502);
    }
    $pinned = null;
    foreach ($ips as $ip) {
        if (!is_public_ip($ip)) {
            fail('url_private');   // any private answer at all: refuse, rather than pick another
        }
        $pinned ??= $ip;
    }
    $path = $parts['path'] ?? '/';
    $query = isset($parts['query']) ? '?' . $parts['query'] : '';
    return [$scheme . '://' . $host . ($port !== ($scheme === 'https' ? 443 : 80) ? ':' . $port : '') . $path . $query, $host, $port, $pinned];
}

/* ------------------------------------------------------------------ fetch */

/**
 * One request, no redirect following. Returns status, headers, body (capped), bytes and elapsed time.
 * $method may be 'GET' or 'HEAD'.
 */
function request(string $url, int $cap, string $method = 'GET'): array {
    [$normalized, $host, $port, $ip] = check_url($url);

    $headers = [];
    $body = '';
    $bytes = 0;
    $aborted = false;

    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL            => $normalized,
        CURLOPT_NOBODY         => $method === 'HEAD',
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_RETURNTRANSFER => false,
        CURLOPT_CONNECTTIMEOUT => CONNECT_TIMEOUT,
        CURLOPT_TIMEOUT        => TOTAL_TIMEOUT,
        CURLOPT_USERAGENT      => USER_AGENT,
        CURLOPT_ENCODING       => '',
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_PROTOCOLS      => CURLPROTO_HTTP | CURLPROTO_HTTPS,
        CURLOPT_COOKIEFILE     => '',
        CURLOPT_RESOLVE        => ["$host:$port:$ip"],
        CURLOPT_HTTPHEADER     => ['Accept: text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8', 'Accept-Language: en-CA,fr-CA;q=0.9'],
        CURLOPT_HEADERFUNCTION => function ($ch, string $line) use (&$headers): int {
            $len = strlen($line);
            $pos = strpos($line, ':');
            if ($pos !== false) {
                $name = strtolower(trim(substr($line, 0, $pos)));
                $value = trim(substr($line, $pos + 1));
                if ($name !== '' && !isset($headers[$name])) {
                    $headers[$name] = substr($value, 0, 500);
                }
            }
            return $len;
        },
        CURLOPT_WRITEFUNCTION  => function ($ch, string $chunk) use (&$body, &$bytes, &$aborted, $cap): int {
            $len = strlen($chunk);
            $bytes += $len;
            if (strlen($body) < $cap) {
                $body .= substr($chunk, 0, $cap - strlen($body));
            }
            if ($bytes > $cap * 4) {   // far past the cap: stop pulling
                $aborted = true;
                return 0;
            }
            return $len;
        },
    ]);

    $started = microtime(true);
    $okCurl = curl_exec($ch);
    $elapsed = (int) round((microtime(true) - $started) * 1000);
    $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($okCurl === false && !$aborted && $status === 0) {
        return ['ok' => false, 'status' => 0, 'error' => $error, 'headers' => [], 'body' => '', 'bytes' => 0, 'elapsedMs' => $elapsed, 'url' => $normalized];
    }

    return [
        'ok'        => $status >= 200 && $status < 400,
        'status'    => $status,
        'headers'   => $headers,
        'body'      => $body,
        'bytes'     => $bytes,
        'truncated' => $aborted || $bytes > strlen($body),
        'elapsedMs' => $elapsed,
        'url'       => $normalized,
    ];
}

/** Follow redirects by hand so every hop is validated. */
function fetch_page(string $url): array {
    $redirects = [];
    $current = $url;
    for ($i = 0; $i <= MAX_REDIRECTS; $i++) {
        $res = request($current, MAX_BYTES);
        if ($res['status'] === 0) {
            fail('fetch_failed', 502, ['detail' => $res['error'] ?? '']);
        }
        $location = $res['headers']['location'] ?? null;
        if ($res['status'] >= 300 && $res['status'] < 400 && $location) {
            $next = resolve_relative($current, $location);
            $redirects[] = $next;
            $current = $next;
            continue;
        }
        $res['redirects'] = $redirects;
        $res['finalUrl'] = $current;
        return $res;
    }
    fail('too_many_redirects', 502);
}

function resolve_relative(string $base, string $target): string {
    if (preg_match('#^https?://#i', $target)) {
        return $target;
    }
    $parts = parse_url($base);
    $root = ($parts['scheme'] ?? 'https') . '://' . ($parts['host'] ?? '');
    if (str_starts_with($target, '/')) {
        return $root . $target;
    }
    $dir = rtrim(dirname($parts['path'] ?? '/'), '/');
    return $root . $dir . '/' . $target;
}

/** A best-effort side request. Never fails the whole scan. */
function probe(string $url, string $method = 'GET'): array {
    try {
        $res = request($url, MAX_PROBE_BYTES, $method);
    } catch (Throwable) {
        return ['status' => 0, 'ok' => false];
    }
    return [
        'status'   => $res['status'],
        'ok'       => $res['status'] >= 200 && $res['status'] < 300,
        'location' => $res['headers']['location'] ?? null,
        'body'     => substr($res['body'] ?? '', 0, 4000),
        'bytes'    => $res['bytes'] ?? 0,
        'url'      => $res['url'] ?? $url,
    ];
}

/* ------------------------------------------------------------------- run */

$page = fetch_page($input);
if ($page['status'] >= 400) {
    fail('site_error', 502, ['status' => $page['status']]);
}

$parts = parse_url($page['finalUrl']);
$origin = ($parts['scheme'] ?? 'https') . '://' . ($parts['host'] ?? '');
$html = $page['body'];

$probes = [
    'robots'  => probe($origin . '/robots.txt'),
    'sitemap' => probe($origin . '/sitemap.xml', 'HEAD'),
];
if (!$probes['sitemap']['ok']) {
    $alt = probe($origin . '/sitemap_index.xml', 'HEAD');
    if ($alt['ok']) {
        $probes['sitemap'] = $alt;
    }
}
// WordPress-only probes, so we don't knock on doors that cannot answer
if (preg_match('#/wp-(content|includes)/#i', $html) || stripos($html, 'wordpress') !== false) {
    $probes['wpJson'] = probe($origin . '/wp-json/', 'HEAD');
    $probes['readme'] = probe($origin . '/readme.html');
}
// Does the http:// version send visitors to https?
if (str_starts_with($origin, 'https://')) {
    $probes['insecure'] = probe('http://' . ($parts['host'] ?? '') . '/', 'HEAD');
}
// Is there a French (or English) version at the usual place?
$probes['fr'] = probe($origin . '/fr/', 'HEAD');
$probes['en'] = probe($origin . '/en/', 'HEAD');

echo json_encode([
    'ok'        => true,
    'url'       => $input,
    'finalUrl'  => $page['finalUrl'],
    'status'    => $page['status'],
    'elapsedMs' => $page['elapsedMs'],
    'bytes'     => $page['bytes'],
    'truncated' => (bool) ($page['truncated'] ?? false),
    'headers'   => $page['headers'],
    'redirects' => $page['redirects'],
    'html'      => $html,
    'probes'    => $probes,
], JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
