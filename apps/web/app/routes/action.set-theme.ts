import { createThemeAction } from 'remix-themes';

import { createThemeSessionResolverWithSecret } from '../sessions.server';
import type { Route } from './+types/action.set-theme';

export const action = (args: Route.ActionArgs) => {
  const { context } = args;
  const sessionSecret =
    context.cloudflare.env.SESSION_SECRET ||
    (import.meta.env.DEV ? 'dev-theme-secret' : '');
  const resolver = createThemeSessionResolverWithSecret(sessionSecret);
  return createThemeAction(resolver)(args);
};
