import { describe, expect, it } from 'vitest';
import {
  failureDetailsText,
  formatDuration,
  summarizeCompatibility,
} from '../../compatibility/runner/report.mjs';

describe('compatibility summary', () => {
  it('counts selected statuses and calculates selected pass rate', () => {
    const summary = summarizeCompatibility(
      [
        { status: 'passed', durationMs: 1200 },
        { status: 'failed', durationMs: 2300 },
        { status: 'unsupported', durationMs: 0 },
        { status: 'not executed', durationMs: 0 },
      ],
      {
        runtime: 'v24.21.0',
        packageName: 'nestjs-swagger-sync',
        packageVersion: '6.7.0',
        artifact: 'packed tarball',
        durationMs: 3500,
      },
    );

    expect(summary).toEqual({
      status: 'failed',
      total: 4,
      selected: 3,
      passed: 1,
      failed: 1,
      unsupported: 1,
      notRun: 1,
      passRate: 33.33,
      durationMs: 3500,
      runtime: 'v24.21.0',
      packageName: 'nestjs-swagger-sync',
      packageVersion: '6.7.0',
      artifact: 'packed tarball',
    });
  });

  it('formats durations in seconds and minutes', () => {
    expect(formatDuration(0)).toBe('0.00s');
    expect(formatDuration(4200)).toBe('4.20s');
    expect(formatDuration(65000)).toBe('1m 5.00s');
  });

  it('formats concise failure details for the final report', () => {
    expect(
      failureDetailsText([
        {
          scenario: 'nestjs-12/express/cjs (node 24)',
          node: '24',
          status: 'failed',
          reason: 'install failed\nfull command output',
          durationMs: 1200,
        },
        {
          scenario: 'nestjs-12/fastify/esm (node 24)',
          node: '24',
          status: 'passed',
          reason: 'ok',
          durationMs: 800,
        },
      ]),
    ).toContain('nestjs-12/express/cjs (node 24) [Node 24] — install failed');
  });
});
