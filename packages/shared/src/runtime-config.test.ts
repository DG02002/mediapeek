import { describe, expect, it } from 'vitest';

import {
  DEFAULT_RUNTIME_CONFIG,
  resolveRuntimeConfig,
} from './runtime-config';

describe('resolveRuntimeConfig', () => {
  it('uses defaults when env is missing', () => {
    expect(resolveRuntimeConfig(undefined)).toEqual(DEFAULT_RUNTIME_CONFIG);
  });

  it('parses valid values', () => {
    expect(
      resolveRuntimeConfig({
        APP_ENV: 'staging',
        LOG_SAMPLE_RATE: '0.35',
        LOG_SLOW_REQUEST_MS: '5000',
        LOG_FORCE_ALL_REQUESTS: 'true',
      }),
    ).toEqual({
      appEnv: 'staging',
      logSampleRate: 0.35,
      logSlowRequestMs: 5000,
      logForceAllRequests: true,
    });
  });

  it('clamps out-of-range numeric values', () => {
    expect(
      resolveRuntimeConfig({
        LOG_SAMPLE_RATE: '-2',
        LOG_SLOW_REQUEST_MS: '999999',
      }),
    ).toEqual({
      ...DEFAULT_RUNTIME_CONFIG,
      logSampleRate: 0,
      logSlowRequestMs: 300000,
    });
  });

  it('falls back for invalid booleans and environment', () => {
    expect(
      resolveRuntimeConfig({
        APP_ENV: 'qa',
        LOG_FORCE_ALL_REQUESTS: 'not-a-boolean',
      }),
    ).toEqual({
      ...DEFAULT_RUNTIME_CONFIG,
      appEnv: 'production',
      logForceAllRequests: false,
    });
  });
});
