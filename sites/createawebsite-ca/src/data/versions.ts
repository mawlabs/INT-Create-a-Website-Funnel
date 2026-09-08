/**
 * Reference versions for the site audit. Refresh these when the upstream releases move; the audit logic itself
 * never hard-codes a version.
 *
 * TODO(angelique): re-check on each quarterly review — WordPress ships two or three releases a year and PHP
 * retires a branch every December. Sources: wordpress.org/download/releases, php.net/supported-versions.
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
    // 8.2 is in security-only support; 8.1 and older no longer receive security fixes.
    securityOnly: '8.3',
    eol: '8.2',
  },
  jquery: { latest: '3.7', minSupported: '3.5' },
};
