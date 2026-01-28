import { index, route, type RouteConfig } from '@react-router/dev/routes';

export default [
  index('routes/home/route.tsx'),

  route('resource/analyze', 'routes/api/analyze/route.ts'),
  route('privacy', 'routes/privacy/route.tsx'),
  route('terms', 'routes/terms/route.tsx'),
  route(
    '.well-known/appspecific/com.chrome.devtools.json',
    'routes/well-known-devtools.ts',
  ),
  route('action/set-theme', 'routes/action.set-theme.ts'),
] satisfies RouteConfig;
