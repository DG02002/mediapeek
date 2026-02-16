import type { AppEnvironment } from '@mediapeek/shared/runtime-config';
import { isProductionEnvironment } from '@mediapeek/shared/runtime-config';
import { createCookieSessionStorage } from 'react-router';
import { createThemeSessionResolver } from 'remix-themes';

const getSessionStorage = (secret: string, appEnv: AppEnvironment) =>
  createCookieSessionStorage({
    cookie: {
      name: 'theme',
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secrets: [secret],
      secure: isProductionEnvironment(appEnv),
    },
  });

export const createThemeSessionResolverWithSecret = (
  secret: string,
  appEnv: AppEnvironment,
) => createThemeSessionResolver(getSessionStorage(secret, appEnv));
