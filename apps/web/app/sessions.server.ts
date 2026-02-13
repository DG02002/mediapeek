import { createCookieSessionStorage } from 'react-router';
import { createThemeSessionResolver } from 'remix-themes';

// You can default to 'development' if import.meta.env.MODE is not set
const isProduction = import.meta.env.MODE === 'production';

const getSessionStorage = (secret: string) =>
  createCookieSessionStorage({
    cookie: {
      name: 'theme',
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secrets: [secret],
      // Set domain and secure only if in production
      ...(isProduction
        ? { domain: 'your-production-domain.com', secure: true }
        : {}),
    },
  });

export const createThemeSessionResolverWithSecret = (secret: string) =>
  createThemeSessionResolver(getSessionStorage(secret));
