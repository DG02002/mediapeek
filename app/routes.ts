import { index, type RouteConfig } from '@react-router/dev/routes';

export default [
  index('routes/_index.tsx'),

  { file: 'routes/resource.analyze.ts', path: 'resource/analyze' },
  {
    path: '.well-known/appspecific/com.chrome.devtools.json',
    file: 'routes/well-known-devtools.ts',
  },
  {
    path: 'action/set-theme',
    file: 'routes/action.set-theme.ts',
  },
] satisfies RouteConfig;
