import { describe, it, expect } from 'vitest';
import { correlateCves } from '@/lib/scanner/cve';
import type { Technology } from '@/types/scanner';

describe('correlateCves', () => {
  it('returns unchanged list and empty findings when no technologies are provided', async () => {
    const result = await correlateCves([]);
    expect(result.technologies).toHaveLength(0);
    expect(result.findings).toHaveLength(0);
  });

  it('detects critical Apache 2.4.49 Path Traversal (CVE-2021-41773)', async () => {
    const techs: Technology[] = [
      {
        name: 'Apache',
        version: '2.4.49',
        category: 'Web Server',
        isOutdated: false,
      },
    ];

    const result = await correlateCves(techs);
    expect(result.technologies[0].isOutdated).toBe(true);
    expect(result.technologies[0].cveCount).toBeGreaterThanOrEqual(1);

    const cveFinding = result.findings.find((f) => f.id.includes('cve-2021-41773'));
    expect(cveFinding).toBeDefined();
    expect(cveFinding?.priority).toBe('critical');
    expect(cveFinding?.category).toBe('Software Vulnerabilities');
    expect(cveFinding?.remediation).toContain('2.4.51');
    expect(cveFinding?.cwe).toContain('CWE-937');
  });

  it('detects known XSS vulnerability in legacy jQuery 1.12.4', async () => {
    const techs: Technology[] = [
      {
        name: 'jQuery',
        version: '1.12.4',
        category: 'JavaScript Library',
        isOutdated: false,
      },
    ];

    const result = await correlateCves(techs);
    expect(result.technologies[0].isOutdated).toBe(true);

    const jqueryFinding = result.findings.find((f) => f.id.includes('cve-2020-11022'));
    expect(jqueryFinding).toBeDefined();
    expect(jqueryFinding?.priority).toBe('medium');
    expect(jqueryFinding?.title).toContain('CVE-2020-11022');
  });

  it('does not trigger offline rules on modern patched versions', async () => {
    const techs: Technology[] = [
      {
        name: 'Nginx',
        version: '1.26.1',
        category: 'Web Server',
        isOutdated: false,
      },
      {
        name: 'Apache',
        version: '2.4.58',
        category: 'Web Server',
        isOutdated: false,
      },
    ];

    const result = await correlateCves(techs);
    const offlineRuleMatches = result.findings.filter(
      (f) => f.id.includes('cve-2021-41773') || f.id.includes('cve-2019-9511')
    );
    expect(offlineRuleMatches).toHaveLength(0);
  });
});
