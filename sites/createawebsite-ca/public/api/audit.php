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
const PROBE_TIMEOUT    = 4;     // side requests get less rope than the page itself
const PROBE_BUDGET     = 12;    // seconds for all side requests together; the rest are skipped
const MAX_REDIRECTS    = 4;
const SCAN_DEADLINE    = 25;        // seconds for the whole scan, whatever it is doing
const SCAN_MAX_BYTES   = 8000000;   // 8 MB pulled in total, across the page and every redirect hop
const RATE_LIMIT       = 12;        // scans
const RATE_WINDOW      = 600;       // per 10 minutes, per IP
const USER_AGENT       = 'Mozilla/5.0 (compatible; createawebsite.ca site check; +https://createawebsite.ca/)';
const NOT_FOUND_PATH   = 'maw-site-check-does-not-exist-8f21c4';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');

/**
 * Wall clock for the whole request. PHP's max_execution_time counts CPU on Linux, so it does not bound a
 * request that is asleep on a socket or on a DNS lookup that will never answer — which is most of what this
 * file does. Each hop and each probe checks this before starting.
 */
$scanStartedAt = microtime(true);
$scanBytes = 0;
function past_deadline(): bool {
    global $scanStartedAt;
    return (microtime(true) - $scanStartedAt) > SCAN_DEADLINE;
}

function fail(string $code, int $status = 400, array $extra = []): never {
    http_response_code($status);
    echo json_encode(['ok' => false, 'error' => $code] + $extra, JSON_UNESCAPED_SLASHES);
    exit;
}

/* ----------------------------------------------------------------- input */

// Preflight. Without this, a docroot missing curl — or running an older PHP than the syntax here needs —
// answers every visitor with something that reads like their own fault. Say it is ours.
if (PHP_VERSION_ID < 80100 || !extension_loaded('curl')) {
    fail('server_unavailable', 503);
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    fail('method_not_allowed', 405);
}

// A POST carrying Content-Type: text/plain is a CORS "simple request" — no preflight — so any page on the
// internet could make every one of its visitors drive this endpoint. They cannot read the answer, but the
// answer is not what they are after: the outbound requests are. Insisting on JSON forces a preflight, and we
// answer preflights without Access-Control-Allow-Origin, so a cross-origin caller never gets to send this.
$contentType = strtolower(trim(explode(';', (string) ($_SERVER['CONTENT_TYPE'] ?? ''))[0]));
if ($contentType !== 'application/json') {
    fail('method_not_allowed', 415);
}

// And when the browser tells us where the page came from, believe it.
$origin = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');
if ($origin !== '') {
    $originHost = strtolower((string) (parse_url($origin, PHP_URL_HOST) ?? ''));
    $ourHost = strtolower(explode(':', (string) ($_SERVER['HTTP_HOST'] ?? ''))[0]);
    if ($originHost === '' || $originHost !== $ourHost) {
        fail('method_not_allowed', 403);
    }
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

/**
 * Where the counters live: one directory ABOVE the docroot, so nothing here is ever served over the web and
 * nothing here is wiped by the deploy, which rsyncs `--delete` into the docroot itself.
 *
 * Not sys_get_temp_dir(): on shared hosting that is shared with every other account on the box, and it can
 * be per-process or swept between requests — a rate limiter that quietly forgets is not one.
 *
 * Returns null when the store cannot be used at all, which the caller treats as a broken server rather than
 * as permission to proceed.
 */
function rate_dir(): ?string {
    // audit.php sits at <docroot>/api/audit.php, so two levels up is the account directory beside the docroot.
    $dir = dirname(__DIR__, 2) . '/.caw-audit';
    if (!is_dir($dir) && !@mkdir($dir, 0700, true) && !is_dir($dir)) {
        return null;
    }
    return is_writable($dir) ? $dir : null;
}

/** Occasionally sweep counters nobody has touched since well past the window, so the directory cannot grow forever. */
function prune_rate_dir(string $dir, int $now): void {
    if (random_int(1, 50) !== 1) {
        return;
    }
    foreach (@scandir($dir) ?: [] as $name) {
        if (!str_ends_with($name, '.json')) {
            continue;
        }
        $path = $dir . '/' . $name;
        if (@filemtime($path) < $now - (RATE_WINDOW * 4)) {
            @unlink($path);
        }
    }
}

/**
 * 'ok' | 'limited' | 'unavailable'.
 *
 * It used to return false — let it through — when the store could not be opened, which left an
 * unauthenticated URL fetcher running with no limit at all on a shared hosting account, and said nothing.
 * A public fetcher fails CLOSED. The third state exists so that a broken store is reported honestly ("this
 * is our fault, email us") instead of wearing the "you have made a few checks, wait a couple of minutes"
 * wording, which would be a lie that never stops being told.
 *
 * Keyed on REMOTE_ADDR, which cannot be forged by the caller. If a CDN or proxy is ever put in front of this
 * docroot, REMOTE_ADDR becomes the proxy and every visitor shares one bucket — tools/selftest.php is what
 * detects that, and it reported a real per-visitor address on 2026-09-17.
 */
function rate_check(): string {
    $dir = rate_dir();
    if ($dir === null) {
        return 'unavailable';
    }
    $now = time();
    prune_rate_dir($dir, $now);

    $file = $dir . '/' . hash('sha256', client_ip()) . '.json';
    $handle = @fopen($file, 'c+');
    if ($handle === false) {
        return 'unavailable';
    }
    try {
        if (!flock($handle, LOCK_EX)) {
            return 'unavailable';
        }
        $contents = stream_get_contents($handle) ?: '[]';
        $hits = json_decode($contents, true);
        $hits = is_array($hits) ? $hits : [];
        $hits = array_values(array_filter($hits, static fn ($t) => is_int($t) && $t > $now - RATE_WINDOW));
        if (count($hits) >= RATE_LIMIT) {
            return 'limited';
        }
        $hits[] = $now;
        ftruncate($handle, 0);
        rewind($handle);
        fwrite($handle, json_encode($hits));
        return 'ok';
    } finally {
        flock($handle, LOCK_UN);
        fclose($handle);
    }
}

$rate = rate_check();
if ($rate === 'unavailable') {
    fail('server_unavailable', 503);
}
if ($rate === 'limited') {
    fail('rate_limited', 429);
}

/* --------------------------------------------------------- URL validation */

/**
 * Is this address one we are willing to connect to?
 *
 * filter_var's NO_PRIV_RANGE|NO_RES_RANGE is NOT a complete deny-list, which is what this used to rely on.
 * Measured on PHP 8.4, it accepts 100.64.0.0/10 (the carrier-grade NAT space a shared host may use for its
 * own internal network), all multicast, 198.18.0.0/15, 192.0.0.0/24, and — worst — the IPv6 forms that carry
 * an IPv4 address inside them. `64:ff9b::7f00:1` is NAT64 for 127.0.0.1 and `2002:7f00:1::1` is 6to4 for the
 * same. Those two defeat the CURLINFO_PRIMARY_IP pin as well, because the address curl connects to IS the
 * address we validated and pinned — peer equals pin, and the loopback response comes back.
 *
 * So: decode the address, pull out any embedded IPv4, and judge what it actually reaches.
 */
function is_public_ip(string $ip): bool {
    $packed = @inet_pton($ip);
    if ($packed === false) {
        return false;
    }
    if (strlen($packed) === 4) {
        return is_public_v4($packed);
    }
    if (strlen($packed) !== 16) {
        return false;
    }
    $embedded = embedded_v4($packed);
    if ($embedded !== null) {
        return is_public_v4($embedded);   // judge where it really goes, not how it is spelled
    }
    return is_public_v6($packed);
}

/** The IPv4 address carried inside a v6 one, for every encoding that routes to v4. Null if there is none. */
function embedded_v4(string $p): ?string {
    $zero12 = str_repeat("\0", 12);
    // ::ffff:a.b.c.d — IPv4-mapped
    if (substr($p, 0, 10) === str_repeat("\0", 10) && substr($p, 10, 2) === "\xff\xff") {
        return substr($p, 12, 4);
    }
    // ::a.b.c.d — IPv4-compatible (deprecated, still routed by some stacks). :: and ::1 are not v4.
    if (substr($p, 0, 12) === $zero12 && substr($p, 12, 4) !== "\0\0\0\0" && substr($p, 12, 4) !== "\0\0\0\1") {
        return substr($p, 12, 4);
    }
    // 2002:V4::/16 — 6to4
    if (substr($p, 0, 2) === "\x20\x02") {
        return substr($p, 2, 4);
    }
    // 64:ff9b::/96 and 64:ff9b:1::/48 — NAT64, well-known and local-use prefixes
    if (substr($p, 0, 4) === "\x00\x64\xff\x9b") {
        return substr($p, 12, 4);
    }
    return null;
}

/** Four packed bytes. Everything not globally routable is refused. */
function is_public_v4(string $p): bool {
    [$a, $b] = [ord($p[0]), ord($p[1])];
    $long = (ord($p[0]) << 24) | (ord($p[1]) << 16) | (ord($p[2]) << 8) | ord($p[3]);
    $in = static fn (string $cidr): bool => (static function () use ($cidr, $long): bool {
        [$net, $bits] = explode('/', $cidr);
        $mask = $bits === '0' ? 0 : (-1 << (32 - (int) $bits)) & 0xFFFFFFFF;
        return ($long & $mask) === (ip2long($net) & $mask);
    })();

    foreach ([
        '0.0.0.0/8',          // "this network"
        '10.0.0.0/8',         // private
        '100.64.0.0/10',      // carrier-grade NAT / shared address space
        '127.0.0.0/8',        // loopback
        '169.254.0.0/16',     // link-local, and the cloud metadata address
        '172.16.0.0/12',      // private
        '192.0.0.0/24',       // IETF protocol assignments
        '192.0.2.0/24',       // documentation
        '192.88.99.0/24',     // 6to4 relay anycast
        '192.168.0.0/16',     // private
        '198.18.0.0/15',      // benchmarking
        '198.51.100.0/24',    // documentation
        '203.0.113.0/24',     // documentation
        '224.0.0.0/4',        // multicast
        '240.0.0.0/4',        // reserved, includes 255.255.255.255
    ] as $cidr) {
        if ($in($cidr)) {
            return false;
        }
    }
    unset($a, $b);
    return true;
}

/** Sixteen packed bytes, with no embedded IPv4 (that is handled before we get here). */
function is_public_v6(string $p): bool {
    $starts = static fn (string $prefix): bool => str_starts_with($p, $prefix);

    if ($p === str_repeat("\0", 16)) return false;                       // ::
    if ($p === str_repeat("\0", 15) . "\x01") return false;              // ::1
    if ((ord($p[0]) & 0xFE) === 0xFC) return false;                       // fc00::/7 unique local
    if (ord($p[0]) === 0xFE && (ord($p[1]) & 0xC0) === 0x80) return false; // fe80::/10 link-local
    if (ord($p[0]) === 0xFF) return false;                                // ff00::/8 multicast
    if ($starts("\x20\x01\x0d\xb8")) return false;                       // 2001:db8::/32 documentation
    if ($starts("\x20\x01\x00\x00")) return false;                       // 2001::/32 Teredo
    if ($starts("\x01\x00\x00\x00\x00\x00\x00\x00")) return false;      // 100::/64 discard-only
    return true;
}

/** Every address the host resolves to, or the literal itself when the host is already an address. */
function resolve_host(string $host): array {
    if (filter_var($host, FILTER_VALIDATE_IP) !== false) {
        return [$host];
    }
    $ips = [];
    $v4 = @gethostbynamel($host);
    if (is_array($v4) && $v4 !== []) {
        // Stop here. Neither of these calls takes a timeout, and curl's timeouts do not cover them at all
        // because CURLOPT_RESOLVE means libcurl performs no DNS of its own. A host that answers A instantly
        // and blackholes AAAA could otherwise hold a worker for the resolver's full retry budget, at no CPU
        // cost, on every hop and every probe.
        return array_values(array_unique($v4));
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
 * Validate a URL. Returns ['ok' => true, 'url', 'host', 'port', 'ip'] or ['ok' => false, 'reason' => code].
 *
 * This function REFUSES; it never ends the request. That distinction matters: a side probe that cannot be
 * validated — a domain with no `www.` record, a redirect to a non-standard port — must leave the scan intact,
 * and a refusal thrown as `exit` from three frames down cannot be caught by anything. Only the caller knows
 * whether a refusal is the visitor's problem or the scanned site's.
 *
 * The rules below are unchanged: public http(s) only, default ports only, we resolve the host ourselves, and
 * a single private answer refuses the whole name rather than letting us pick another address.
 */
function validate_url(string $url): array {
    $no = static fn (string $reason): array => ['ok' => false, 'reason' => $reason];

    $parts = parse_url($url);
    if ($parts === false || empty($parts['host'])) {
        return $no('url_invalid');
    }
    $scheme = strtolower($parts['scheme'] ?? '');
    if ($scheme !== 'http' && $scheme !== 'https') {
        return $no('url_scheme');
    }
    if (!empty($parts['user']) || !empty($parts['pass'])) {
        return $no('url_invalid');
    }
    $host = $parts['host'];
    $port = (int) ($parts['port'] ?? ($scheme === 'https' ? 443 : 80));
    if ($port !== 80 && $port !== 443) {
        return $no('url_port');
    }
    if (str_ends_with(strtolower($host), '.local') || !str_contains($host, '.')) {
        return $no('url_private');
    }
    $ips = resolve_host($host);
    if ($ips === []) {
        return $no('dns_failed');
    }
    $pinned = null;
    foreach ($ips as $ip) {
        if (!is_public_ip($ip)) {
            return $no('url_private');   // any private answer at all: refuse, rather than pick another
        }
        $pinned ??= $ip;
    }
    $path = $parts['path'] ?? '/';
    $query = isset($parts['query']) ? '?' . $parts['query'] : '';
    $normalized = $scheme . '://' . $host
        . ($port !== ($scheme === 'https' ? 443 : 80) ? ':' . $port : '')
        . $path . $query;
    return ['ok' => true, 'url' => $normalized, 'host' => $host, 'port' => $port, 'ip' => $pinned];
}

/* ------------------------------------------------------------------ fetch */

/**
 * One request, no redirect following. Returns status, headers, body (capped), bytes and elapsed time.
 * $method may be 'GET' or 'HEAD'.
 */
function request(string $url, int $cap, string $method = 'GET', int $timeout = TOTAL_TIMEOUT): array {
    $checked = validate_url($url);
    if (!$checked['ok']) {
        // The same shape a dead connection returns, so every caller already handles it.
        return ['ok' => false, 'status' => 0, 'error' => $checked['reason'], 'headers' => [], 'body' => '',
                'bytes' => 0, 'elapsedMs' => 0, 'url' => $url];
    }
    [$normalized, $host, $port, $ip] = [$checked['url'], $checked['host'], $checked['port'], $checked['ip']];

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
        CURLOPT_TIMEOUT        => $timeout,
        CURLOPT_USERAGENT      => USER_AGENT,
        CURLOPT_ENCODING       => '',
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_PROTOCOLS      => CURLPROTO_HTTP | CURLPROTO_HTTPS,
        CURLOPT_COOKIEFILE     => '',
        // libcurl reads http_proxy/https_proxy from the environment unless this is set. A proxy resolves the
        // name itself, which would quietly make CURLOPT_RESOLVE — the whole rebinding defence — do nothing.
        CURLOPT_PROXY          => '',
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
            global $scanBytes;
            $len = strlen($chunk);
            $bytes += $len;
            $scanBytes += $len;
            if (strlen($body) < $cap) {
                $body .= substr($chunk, 0, $cap - strlen($body));
            }
            // Per-response, and across the whole scan: five redirect hops at cap*4 each would otherwise let
            // one POST pull tens of megabytes, which a hostile target can serve cheaply with compression.
            if ($bytes > $cap * 4 || $scanBytes > SCAN_MAX_BYTES) {
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
    $peer = (string) curl_getinfo($ch, CURLINFO_PRIMARY_IP);
    $error = curl_error($ch);
    curl_close($ch);

    // Belt and braces on the pin: if we did not end up talking to the address we validated, discard the
    // answer whatever it says. This catches a proxy, a rebinding race, or a future edit that drops the pin.
    if ($peer !== '' && $peer !== $ip) {
        return ['ok' => false, 'status' => 0, 'error' => 'url_private', 'headers' => [], 'body' => '',
                'bytes' => 0, 'elapsedMs' => $elapsed, 'url' => $normalized];
    }

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

/**
 * Follow redirects by hand so every hop is validated.
 *
 * This is the one place a refusal ends the request, because this is the one address the visitor typed. Their
 * own address earns a precise answer — "we couldn't find that address" belongs to a name THEY wrote, never to
 * a hop the site chose for them.
 */
function fetch_page(string $url): array {
    /** Refusals that describe the address rather than the connection, and are worth repeating verbatim. */
    $addressReasons = ['url_invalid', 'url_scheme', 'url_port', 'url_private', 'dns_failed'];

    $redirects = [];
    $current = $url;
    for ($i = 0; $i <= MAX_REDIRECTS; $i++) {
        if ($i > 0 && past_deadline()) {
            fail('fetch_failed', 504, ['detail' => 'deadline']);
        }
        $res = request($current, MAX_BYTES);
        if ($res['status'] === 0) {
            $reason = $res['error'] ?? '';
            if ($i === 0 && in_array($reason, $addressReasons, true)) {
                fail($reason, $reason === 'dns_failed' ? 502 : 400);
            }
            if ($i > 0 && in_array($reason, $addressReasons, true)) {
                // The site sent us somewhere we will not or cannot go. Not the visitor's spelling.
                fail('redirect_unreachable', 502, ['detail' => $reason]);
            }
            fail('fetch_failed', 502, ['detail' => $reason]);
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
    $target = trim($target);
    if ($target === '') {
        return $base;
    }
    if (preg_match('#^https?://#i', $target)) {
        return $target;
    }
    $parts = parse_url($base);
    $scheme = $parts['scheme'] ?? 'https';
    // "//host/path" inherits the scheme and REPLACES the host. Treating it as a path — which is what the
    // leading slash made it look like — kept us on the original site at a nonsense address, so a site
    // legitimately redirecting to a CDN read as a broken one. Each hop is re-validated either way.
    if (str_starts_with($target, '//')) {
        return $scheme . ':' . preg_replace('#^/+#', '//', $target);
    }
    // "https:/host/" — one slash. Browsers normalise this; so do we, rather than reading it as a path.
    if (preg_match('#^(https?):/([^/].*)$#i', $target, $m)) {
        return strtolower($m[1]) . '://' . $m[2];
    }
    $root = $scheme . '://' . ($parts['host'] ?? '');
    if (str_starts_with($target, '/')) {
        return $root . $target;
    }
    $dir = rtrim(dirname($parts['path'] ?? '/'), '/');
    return $root . $dir . '/' . $target;
}

/**
 * A best-effort side request. Never fails the whole scan, gets a shorter timeout than the page, and stops
 * asking altogether once the side requests have used their shared budget: the visitor is waiting.
 */
function probe(string $url, string $method = 'GET', int $keep = 4000): array {
    static $spent = 0.0;
    if ($spent > PROBE_BUDGET || past_deadline()) {
        return ['status' => 0, 'ok' => false, 'skipped' => true];
    }
    $started = microtime(true);
    try {
        $res = request($url, MAX_PROBE_BYTES, $method, PROBE_TIMEOUT);
    } catch (Throwable) {
        $spent += microtime(true) - $started;
        return ['status' => 0, 'ok' => false];
    }
    $spent += microtime(true) - $started;
    return [
        'status'   => $res['status'],
        'ok'       => $res['status'] >= 200 && $res['status'] < 300,
        'location' => $res['headers']['location'] ?? null,
        'body'     => substr($res['body'] ?? '', 0, $keep),
        'bytes'    => $res['bytes'] ?? 0,
        'url'      => $res['url'] ?? $url,
    ];
}

/* ------------------------------------------------------------------- run */

/**
 * Is a security service turning us away, rather than the site being broken? A great many small-business
 * sites sit behind Cloudflare, Sucuri or a firewall plugin, and telling their owner "your site answered with
 * an error" when it is really "we were refused at the door" is both wrong and alarming.
 *
 * 403, 406 and 429 on a home page are a bot wall in practice — a site that is genuinely broken returns 5xx.
 * 503 is treated as real maintenance unless a firewall names itself.
 */
function is_blocked(array $page): bool {
    $status = $page['status'];
    $h = $page['headers'];
    $named = ($h['server'] ?? '') . ' ' . ($h['via'] ?? '') . ' ' . ($h['x-powered-by'] ?? '');
    $fingerprints = ($h['cf-ray'] ?? '') . ($h['cf-mitigated'] ?? '') . ($h['x-sucuri-id'] ?? '') . ($h['x-iinfo'] ?? '');
    $firewall = $fingerprints !== ''
        || preg_match('/cloudflare|sucuri|incapsula|imperva|akamai|ddos-guard|wordfence/i', $named) === 1
        || preg_match('/attention required|just a moment|checking your browser|sucuri website firewall|enable javascript and cookies|ray id/i', $page['body'] ?? '') === 1;

    if ($status === 403 || $status === 406 || $status === 429) {
        return true;
    }
    return $status === 503 && $firewall;
}

$page = fetch_page($input);
if ($page['status'] >= 400) {
    fail(is_blocked($page) ? 'site_blocked' : 'site_error', 502, ['status' => $page['status']]);
}

$parts = parse_url($page['finalUrl']);
$origin = ($parts['scheme'] ?? 'https') . '://' . ($parts['host'] ?? '');
$html = $page['body'];

$host = $parts['host'] ?? '';

$probes = [
    'robots' => probe($origin . '/robots.txt', 'GET', 12000),
    // Fetched, not just asked about: a sitemap address that answers with a web page is its own finding.
    'sitemap' => probe($origin . '/sitemap.xml'),
];
if (!$probes['sitemap']['ok']) {
    $alt = probe($origin . '/sitemap_index.xml');
    if ($alt['ok']) {
        $probes['sitemap'] = $alt;
    }
}
// WordPress-only probes, so we don't knock on doors that cannot answer
if (preg_match('#/wp-(content|includes)/#i', $html) || stripos($html, 'wordpress') !== false) {
    $probes['wpJson'] = probe($origin . '/wp-json/', 'HEAD');
    $probes['readme'] = probe($origin . '/readme.html');
    $probes['xmlrpc'] = probe($origin . '/xmlrpc.php');
}
// Does the http:// version send visitors to https?
if (str_starts_with($origin, 'https://')) {
    $probes['insecure'] = probe('http://' . $host . '/', 'HEAD');
}
// Is there a French (or English) version at the usual place?
$probes['fr'] = probe($origin . '/fr/', 'HEAD');
$probes['en'] = probe($origin . '/en/', 'HEAD');

// A path that cannot exist. Anything but a 404 or a 410 here means missing pages are quietly served as
// real ones, which search engines index and visitors never notice.
$probes['notFound'] = probe($origin . '/' . NOT_FOUND_PATH . '/');

// The same site on the other side of the www. If both answer 200 on their own, the site exists twice.
$otherHost = str_starts_with(strtolower($host), 'www.') ? substr($host, 4) : 'www.' . $host;
if ($otherHost !== '' && str_contains($otherHost, '.')) {
    $altScheme = str_starts_with($origin, 'https://') ? 'https' : 'http';
    $probes['altHost'] = probe($altScheme . '://' . $otherHost . '/', 'HEAD');
}

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
