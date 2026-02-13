import sharedConfig from '@mediapeek/config-tailwind';
import type { Config } from 'tailwindcss';

export default {
  ...sharedConfig,
  content: [
    './app/**/{**,.client,.server}/**/*.{js,jsx,ts,tsx}',
    '../../packages/shared/src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
} satisfies Config;
