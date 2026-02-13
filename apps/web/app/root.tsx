import './app.css';

import { Toaster } from '@mediapeek/ui/components/sonner';
import { TooltipProvider } from '@mediapeek/ui/components/tooltip';
import clsx from 'clsx';
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteLoaderData,
} from 'react-router';
import {
  PreventFlashOnWrongTheme,
  type Theme,
  ThemeProvider,
  useTheme,
} from 'remix-themes';

import type { Route } from './+types/root';
import { RouteAnnouncer } from './components/route-announcer';
import { createThemeSessionResolverWithSecret } from './sessions.server';

declare global {
  interface Window {
    ENV: {
      TURNSTILE_SITE_KEY: string;
      ENABLE_TURNSTILE: string;
    };
  }
}

export const links: Route.LinksFunction = () => [
  { rel: 'apple-touch-icon', href: '/ios-home-screen-icon.png' },
  { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
  {
    rel: 'preconnect',
    href: 'https://fonts.gstatic.com',
    crossOrigin: 'anonymous',
  },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap',
  },
];

export async function loader({ request, context }: Route.LoaderArgs) {
  let theme: Theme | null = null;
  try {
    const sessionSecret =
      context.cloudflare.env.SESSION_SECRET ||
      (import.meta.env.DEV ? 'dev-theme-secret' : '');
    if (sessionSecret) {
      const { getTheme } =
        await createThemeSessionResolverWithSecret(sessionSecret)(request);
      theme = getTheme();
    }
  } catch (error) {
    console.error('THEME_CONTEXT_MISSING', error);
  }

  return {
    theme,
    env: {
      TURNSTILE_SITE_KEY: context.cloudflare.env.TURNSTILE_SITE_KEY,
      ENABLE_TURNSTILE: context.cloudflare.env.ENABLE_TURNSTILE,
    },
  };
}

export function Layout({ children }: { children: React.ReactNode }) {
  const data = useRouteLoaderData<typeof loader>('root');
  return (
    <ThemeProvider
      specifiedTheme={data?.theme ?? null}
      themeAction="/action/set-theme"
    >
      <AppWithProviders>{children}</AppWithProviders>
    </ThemeProvider>
  );
}

import { useMediaQuery } from '~/hooks/use-media-query';

// ... (existing imports)

function AppWithProviders({ children }: { children: React.ReactNode }) {
  const data = useRouteLoaderData<typeof loader>('root');
  const env = data?.env ?? {
    TURNSTILE_SITE_KEY: '',
    ENABLE_TURNSTILE: 'false',
  };
  const [theme] = useTheme();
  const isMobile = useMediaQuery('(max-width: 640px)');
  return (
    <html lang="en" className={clsx(theme)}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <PreventFlashOnWrongTheme ssrTheme={Boolean(data?.theme)} />
        <Links />
        {/* Dynamic Favicons */}
        {String(theme) === 'light' ? (
          <link
            rel="icon"
            type="image/png"
            sizes="32x32"
            href="/favicon-dark-32x32.png"
          />
        ) : String(theme) === 'dark' ? (
          <link
            rel="icon"
            type="image/png"
            sizes="32x32"
            href="/favicon-light-32x32.png"
          />
        ) : (
          /* System Default logic (when theme is null/undefined) */
          <>
            <link
              rel="icon"
              type="image/png"
              sizes="32x32"
              href="/favicon-dark-32x32.png"
              media="(prefers-color-scheme: light)"
            />
            <link
              rel="icon"
              type="image/png"
              sizes="32x32"
              href="/favicon-light-32x32.png"
              media="(prefers-color-scheme: dark)"
            />
          </>
        )}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.ENV = ${JSON.stringify(env)}`,
          }}
        />
        <script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          async
          defer
        />
      </head>
      <body className="bg-background text-foreground antialiased">
        <div className="w-full" vaul-drawer-wrapper="">
          <TooltipProvider>
            {children}
            <Toaster position={isMobile ? 'top-center' : 'bottom-right'} />
          </TooltipProvider>
        </div>
        <ScrollRestoration />
        <RouteAnnouncer />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = 'Error';
  let details = 'An unexpected error occurred.';
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? '404' : 'Error';
    details =
      error.status === 404 ? 'Page not found.' : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="container mx-auto p-4 pt-16">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full overflow-x-auto p-4">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
