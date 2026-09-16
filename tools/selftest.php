<?php
/**
 * THROWAWAY DIAGNOSTIC — answers, in one page load, whether audit.php can work on this host.
 *
 * Nothing to configure. Upload it to the docroot, open it in a browser, read the verdict at the top, then
 * press Delete at the bottom. It fetches one harmless public URL and changes nothing else.
 *
 * Load it twice — once on office wifi, once on a phone with wifi off. If it reports the same visitor address
 * both times, the host is behind a proxy and every visitor would share one rate-limit bucket.
 *
 * This file lives in tools/ and not in any site's public/ directory, so no deploy will ever ship it.
 */

declare(strict_types=1);

const PROBE_URL = 'https://api.wordpress.org/core/version-check/1.7/';   // public, tiny, and data we want anyway

header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: no-store');
header('Referrer-Policy: no-referrer');

/* ---- the Delete button at the bottom of the page posts back here ---- */
if (($_POST['action'] ?? '') === 'delete') {
    $gone = @unlink(__FILE__);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><meta charset="utf-8"><title>selftest</title>'
       . '<body style="font:16px/1.6 system-ui,sans-serif;background:#FBF4EA;color:#36393E;padding:3rem 1.5rem;max-width:34rem;margin:0 auto">'
       . ($gone
           ? '<h1 style="font-size:1.5rem">Deleted.</h1><p>The file is gone. Nothing else to do.</p>'
           : '<h1 style="font-size:1.5rem">Could not delete it.</h1><p>The web server does not have permission. '
             . 'Remove <code>' . htmlspecialchars(basename(__FILE__), ENT_QUOTES) . '</code> from the docroot by hand '
             . '(File Manager in Site Tools, or FTP). It reports server details, so do not leave it there.</p>')
       . '</body>';
    exit;
}

/* ---- 1. PHP itself ---- */
// If you are reading PHP source instead of a page, PHP is not enabled on this docroot. That is answer enough.
$php = [
    'version'            => PHP_VERSION,
    'new_enough'         => PHP_VERSION_ID >= 80100,   // audit.php uses PHP 8.1 syntax
    'sapi'               => PHP_SAPI,
    'max_execution_time' => ini_get('max_execution_time'),
    'memory_limit'       => ini_get('memory_limit'),
    'disabled_functions' => ini_get('disable_functions') ?: '(none)',
    'open_basedir'       => ini_get('open_basedir') ?: '(not restricted)',
];

/* ---- 2. curl, and the options the fetcher depends on ---- */
$curl = ['loaded' => extension_loaded('curl')];
if ($curl['loaded']) {
    $v = curl_version();
    $curl += [
        'version'     => $v['version'] ?? '(unknown)',
        'ssl'         => $v['ssl_version'] ?? '(unknown)',
        'protocols'   => implode(', ', array_slice($v['protocols'] ?? [], 0, 10)),
        'has_resolve' => defined('CURLOPT_RESOLVE'),   // the address pin depends on this
    ];
}

/* ---- 3. Is outbound traffic proxied? A proxy resolves names itself, which would void the address pin ---- */
$proxy = [
    'http_proxy'  => getenv('http_proxy') ?: getenv('HTTP_PROXY') ?: '(none)',
    'https_proxy' => getenv('https_proxy') ?: getenv('HTTPS_PROXY') ?: '(none)',
    'all_proxy'   => getenv('all_proxy') ?: getenv('ALL_PROXY') ?: '(none)',
];

/* ---- 4. Can this server resolve a name itself? ---- */
$host = parse_url(PROBE_URL, PHP_URL_HOST);
$resolved = function_exists('gethostbynamel') ? (@gethostbynamel($host) ?: []) : [];
$dns = [
    'gethostbynamel' => function_exists('gethostbynamel') ? 'available' : 'MISSING',
    'dns_get_record' => function_exists('dns_get_record') ? 'available' : 'MISSING',
    'answers'        => $resolved ? implode(', ', $resolved) : '(none — could not resolve)',
];

/* ---- 5. THE question: can this server fetch a website at all? ---- */
$outbound = ['attempted' => PROBE_URL];
if ($curl['loaded']) {
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
    $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    // A response object is not a fetch. Getting back a 403 from a filtering proxy means this server read
    // nothing at all, and reporting that as success is the same mistake the site check itself was making.
    $outbound += [
        'ok'         => $body !== false && $status >= 200 && $status < 400,
        'status'     => $status === 0 ? '(no response)' : $status,
        'peer_ip'    => curl_getinfo($ch, CURLINFO_PRIMARY_IP) ?: '(none)',   // should match a DNS answer above
        'total_time' => round((float) curl_getinfo($ch, CURLINFO_TOTAL_TIME), 3) . ' s',
        'bytes'      => $body === false ? 0 : strlen($body),
        'error'      => curl_error($ch) ?: '(none)',
    ];
    curl_close($ch);
} else {
    $outbound += ['ok' => false, 'error' => 'curl is not loaded'];
}

/* ---- 6. Where can the rate limiter keep its counter? It currently FAILS OPEN if nowhere ---- */
$tmp = sys_get_temp_dir();
$probeFile = $tmp . '/caw-selftest-' . bin2hex(random_bytes(4));
$tmpWritable = @file_put_contents($probeFile, 'x') !== false;
if ($tmpWritable) { @unlink($probeFile); }
$parent = dirname(__DIR__);
$storage = [
    'sys_temp_dir'            => $tmp,
    'sys_temp_writable'       => $tmpWritable,
    'docroot_parent'          => $parent,
    'docroot_parent_writable' => is_writable($parent),
];

/* ---- 7. Who does the server think the visitor is? ---- */
$client = [
    'REMOTE_ADDR'       => $_SERVER['REMOTE_ADDR'] ?? '(not set)',
    'X-Forwarded-For'   => $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '(not set)',
    'CF-Connecting-IP'  => $_SERVER['HTTP_CF_CONNECTING_IP'] ?? '(not set)',
    'X-Forwarded-Proto' => $_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '(not set)',   // decides the .htaccess HTTPS rule
    'HTTPS'             => $_SERVER['HTTPS'] ?? '(not set)',
    'SERVER_SOFTWARE'   => $_SERVER['SERVER_SOFTWARE'] ?? '(not set)',
];

/* ---- verdict ---- */
$canWork = $php['new_enough'] && $curl['loaded'] && ($outbound['ok'] ?? false);
$blockers = array_values(array_filter([
    $php['new_enough'] ? null : 'PHP ' . PHP_VERSION . ' is too old — audit.php needs 8.1 or newer. Raise it in Site Tools → Devs → PHP Manager.',
    $curl['loaded'] ? null : 'The curl extension is not loaded, so the fetcher cannot make any request. Ask support to enable it.',
    ($outbound['ok'] ?? false) ? null : 'This server could not read ' . PROBE_URL . ' — '
        . (($outbound['status'] ?? 0) && $outbound['status'] !== '(no response)'
            ? 'it answered ' . $outbound['status'] . ', which usually means outbound traffic is filtered rather than blocked outright.'
            : 'no response at all (' . ($outbound['error'] ?? 'unknown') . ').')
        . ' That is fatal for the site check — nothing else matters until it is fixed.',
]));
$notes = array_values(array_filter([
    ($proxy['http_proxy'] !== '(none)' || $proxy['https_proxy'] !== '(none)')
        ? 'An environment proxy is set. audit.php ignores it deliberately, because a proxy resolves names itself and would void the address pin. '
          . (($outbound['ok'] ?? false) ? 'Going direct worked here.' : 'Going direct did not work here — that may be exactly why.')
        : null,
    $storage['sys_temp_writable'] ? null : 'The temp directory is not writable, so the rate limiter would fail OPEN — leaving an unauthenticated fetcher on this account. Its counter must move to ' . $parent . '.',
    ($client['X-Forwarded-For'] !== '(not set)' || $client['CF-Connecting-IP'] !== '(not set)') ? 'A proxy sits in front of PHP, so REMOTE_ADDR is not the visitor. The rate limiter has to read the forwarded header or every visitor shares one bucket.' : null,
    ($client['HTTPS'] === '(not set)' && $client['X-Forwarded-Proto'] !== '(not set)') ? 'Apache does not see HTTPS=on but the proxy sets X-Forwarded-Proto — which is exactly the case the .htaccess rule now handles. Good.' : null,
    ($client['HTTPS'] === '(not set)' && $client['X-Forwarded-Proto'] === '(not set)') ? 'Neither HTTPS nor X-Forwarded-Proto is set. Check the site loads over https without a redirect loop.' : null,
]));

$sections = [
    'PHP'                 => $php,
    'curl'                => $curl,
    'Outbound proxy'      => $proxy,
    'Name resolution'     => $dns,
    'Can it fetch a site' => $outbound,
    'Writable storage'    => $storage,
    'This visitor'        => $client,
];
$raw = json_encode(['verdict' => ['audit_php_can_work' => $canWork, 'blockers' => $blockers, 'notes' => $notes]] + $sections,
    JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
$esc = static fn ($v): string => htmlspecialchars(is_bool($v) ? ($v ? 'yes' : 'NO') : (string) $v, ENT_QUOTES);

header('Content-Type: text/html; charset=utf-8');
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Can audit.php work here?</title>
<style>
  body { margin: 0; padding: 2.5rem 1.25rem 4rem; background: #FBF4EA; color: #36393E;
         font: 16px/1.6 system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width: 44rem; margin: 0 auto; }
  h1 { font-size: 1.75rem; line-height: 1.15; margin: 0 0 1rem; letter-spacing: -.02em; }
  h2 { font-size: 1rem; margin: 2rem 0 .5rem; letter-spacing: .06em; text-transform: uppercase;
       font-family: ui-monospace, monospace; font-weight: 500; color: #5c6066; }
  .verdict { padding: 1.25rem; border: 2px solid #36393E; background: #fff; margin-bottom: 1.5rem; }
  .verdict.yes { border-left: 10px solid #2A9D8F; }
  .verdict.no  { border-left: 10px solid #E76F51; }
  .verdict p { margin: .5rem 0 0; }
  ul { margin: .5rem 0 0; padding-left: 1.2rem; }
  li { margin-bottom: .4rem; }
  table { border-collapse: collapse; width: 100%; }
  td { padding: .35rem .75rem .35rem 0; border-bottom: 1px solid rgba(54,57,62,.18); vertical-align: top; }
  td:first-child { font-family: ui-monospace, monospace; font-size: .85rem; color: #5c6066; width: 14rem; }
  td.bad { color: #E76F51; font-weight: 600; }
  textarea { width: 100%; height: 14rem; font-family: ui-monospace, monospace; font-size: .8rem;
             border: 2px solid #36393E; padding: .75rem; background: #fff; color: #36393E; }
  button { font: inherit; font-weight: 600; padding: .7rem 1.4rem; border: 2px solid #36393E;
           background: #E76F51; color: #36393E; cursor: pointer; }
  .danger { margin-top: 2.5rem; padding-top: 1.5rem; border-top: 1px solid rgba(54,57,62,.25); }
</style>
</head>
<body>
<main>
  <h1>Can <code>audit.php</code> work on this host?</h1>

  <div class="verdict <?= $canWork ? 'yes' : 'no' ?>">
    <strong style="font-size:1.15rem"><?= $canWork ? 'Yes — this server can fetch websites.' : 'No — not as things stand.' ?></strong>
    <?php if ($blockers): ?>
      <p>What is stopping it:</p>
      <ul><?php foreach ($blockers as $b): ?><li><?= $esc($b) ?></li><?php endforeach; ?></ul>
    <?php endif; ?>
    <?php if ($notes): ?>
      <p>Worth knowing either way:</p>
      <ul><?php foreach ($notes as $n): ?><li><?= $esc($n) ?></li><?php endforeach; ?></ul>
    <?php endif; ?>
    <?php if (!$blockers && !$notes): ?>
      <p>Nothing else to flag. Send the block at the bottom of this page and the site check can be switched on.</p>
    <?php endif; ?>
  </div>

  <?php foreach ($sections as $title => $rows): ?>
    <h2><?= $esc($title) ?></h2>
    <table>
      <?php foreach ($rows as $k => $v): ?>
        <tr><td><?= $esc($k) ?></td><td class="<?= $v === false ? 'bad' : '' ?>"><?= $esc($v) ?></td></tr>
      <?php endforeach; ?>
    </table>
  <?php endforeach; ?>

  <h2>Send this back</h2>
  <p>Copy everything in the box.</p>
  <textarea readonly onclick="this.select()"><?= $esc($raw) ?></textarea>

  <div class="danger">
    <h2>When you are done</h2>
    <p>This page reports server details. Load it once more from a phone with wifi off (to compare
      <code>REMOTE_ADDR</code>), then remove it.</p>
    <form method="post"><button type="submit" name="action" value="delete">Delete this file from the server</button></form>
  </div>
</main>
</body>
</html>
