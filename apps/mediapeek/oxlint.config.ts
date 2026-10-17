import { defineConfig } from 'oxlint';

import baseConfig from '../../oxlint.config.ts';

export default defineConfig({
  extends: [baseConfig],
  plugins: ['react'],
  jsPlugins: [
    {
      name: 'react-hooks-js',
      specifier: 'eslint-plugin-react-hooks',
    },
  ],
  ignorePatterns: ['build/**', '.react-router/**', '.wrangler/**'],
  overrides: [
    {
      files: ['app/routes/home/route.tsx'],
      rules: {
        'react/iframe-missing-sandbox': 'off',
      },
    },
  ],
  rules: {
    'jest/no-conditional-expect': 'off',
    'react-in-jsx-scope': 'off',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    'react-hooks-js/static-components': 'error',
    'react-hooks-js/use-memo': 'error',
    'react-hooks-js/component-hook-factories': 'error',
    'react-hooks-js/preserve-manual-memoization': 'error',
    'react-hooks-js/incompatible-library': 'error',
    'react-hooks-js/immutability': 'error',
    'react-hooks-js/globals': 'error',
    'react-hooks-js/refs': 'error',
    'react-hooks-js/set-state-in-effect': 'error',
    'react-hooks-js/error-boundaries': 'error',
    'react-hooks-js/purity': 'error',
    'react-hooks-js/set-state-in-render': 'error',
    'react-hooks-js/unsupported-syntax': 'error',
    'react-hooks-js/config': 'error',
    'react-hooks-js/gating': 'error',
    'typescript/no-unnecessary-type-assertion': 'off',
    'typescript/no-unsafe-assignment': 'off',
    'typescript/no-unsafe-call': 'off',
    'typescript/no-unsafe-member-access': 'off',
    'typescript/no-unsafe-return': 'off',
    'typescript/no-unsafe-type-assertion': 'off',
  },
});
