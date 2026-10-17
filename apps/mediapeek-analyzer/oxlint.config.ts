import { defineConfig } from 'oxlint';

import baseConfig from '../../oxlint.config.ts';

export default defineConfig({
  extends: [baseConfig],
  ignorePatterns: ['dist/**', '.wrangler/**'],
  rules: {
    'typescript/no-unsafe-return': 'off',
    'typescript/no-unsafe-type-assertion': 'off',
  },
});
