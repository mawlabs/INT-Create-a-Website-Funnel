/**
 * Reference versions for the site audit. Refresh these when the upstream releases move; the audit logic itself
 * never hard-codes a version.
 *
 * TODO(angelique): these numbers have never been checked against upstream — they came from the model, not
 * from wordpress.org or php.net, and nothing in the build verifies them. Stale data here does not go quiet,
 * it asserts a green tick: a site on a branch that has since been retired is told "nothing to do here". The
 * fix is to fetch them at build time (api.wordpress.org/core/version-check/1.7/ and
 * endoflife.date/api/php.json) and fail the build when either is unreachable — GitHub Actions has the network
 * this sandbox does not. Until then, re-check on each quarterly review:
 * wordpress.org/download/releases, php.net/supported-versions.
 */
import type { VersionData } from '@maw/lander-kit/lib/audit';

export const versions: VersionData = {
  checkedOn: '2026-09-08',
  wordpress: {
    latest: '6.9',
    // Anything older than this is flagged as unsupported rather than merely behind.
    minSupported: '6.6',
  },
  php: {
    current: '8.4',
    // Read as thresholds, not as branch names: below `securityOnly` is security-only, below `eol` is
    // unsupported. PHP 8.3 left active support in December 2025, so 8.2 and 8.3 are both security-only and
    // the threshold is 8.4 — it read 8.3, which told every site on 8.3 "nothing to do here".
    securityOnly: '8.4',
    eol: '8.2',
  },
  jquery: { latest: '3.7', minSupported: '3.5' },
};
