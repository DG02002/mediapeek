import { reactConfig } from '@mediapeek/config-eslint';

export default [
  ...reactConfig,
  {
    ignores: ['build/**', '.react-router/**'],
  },
];
