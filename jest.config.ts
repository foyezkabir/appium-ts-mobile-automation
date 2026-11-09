import type { Config } from 'jest';
import type { ReportOptions } from 'testreportium';

/**
 * Four invariants here are load-bearing, not stylistic — see CLAUDE.md
 * "Config invariants". Do not change them without a device farm.
 *
 *   maxWorkers: 1   one physical device; two workers racing it fail like app bugs
 *   bail: 0         one run must surface EVERY failure
 *   testTimeout     every command is an HTTP round trip + a UiAutomator2 bridge call
 *   implicit wait   never set anywhere — mixing it with explicit waits compounds timeouts
 */
const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.spec.ts'],

  maxWorkers: 1,
  bail: 0,
  testTimeout: 240_000,

  // setupFilesAfterEnv — NOT setupFilesAfterEach, which Jest rejects with TS2561.
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],

  // Provisions the tenant (doctors, chambers, availability) ONCE before any
  // worker starts. Specs resolve their fixtures from what it creates rather
  // than from hardcoded names — see src/data/fixtures.ts.
  globalSetup: '<rootDir>/jest.global-setup.ts',

  reporters: [
    'default',
    ['jest-junit', { outputDirectory: 'appium-reports', outputName: 'junit.xml' }],
    // Self-contained HTML report (history, trends, diagnosis). Pairs failure
    // screenshots from appium-reports/failures/ by slugged test title — the
    // same naming jest.setup.ts writes. Open with: npm run report
    ['testreportium/jest', {
      outputDirectory: 'appium-reports',
      filename: 'report.html',
      projectName: 'Mobile UI Automation',
      // Shown as the Quality Gates panel; a breach is reported, never fails
      // the run on its own (jest's exit code is still the verdict).
      qualityGates: {
        maxFailures: 0,          // no test may fail
        minPassRate: 95,         // at least 95% of tests pass
        maxFlakyRate: 10,        // at most 10% of tests flaky
        minStabilityGrade: 'B',  // suite grade B or better
        noNewFailures: true,     // nothing that passed last run may fail now
      },
      // Writes appium-reports/quarantine.json: the tests flaky enough to set aside.
      quarantine: true,
      // Typed: a misspelt rule or a wrong value fails `npm run typecheck`
      // instead of that rule silently showing as "Not set".
    } satisfies ReportOptions],
  ],

  verbose: true,
};

export default config;
