import { index, type RouteConfig } from '@react-router/dev/routes';

export default [
  index('routes/home/route.tsx'),

  { file: 'routes/api/analyze/route.ts', path: 'resource/analyze' },
  {
    path: '.well-known/appspecific/com.chrome.devtools.json',
    file: 'routes/well-known-devtools.ts',
  },
  {
    path: 'action/set-theme',
    file: 'routes/action.set-theme.ts',
  },
] satisfies RouteConfig;
