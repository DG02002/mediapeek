import {
  isDevelopmentEnvironment,
  resolveRuntimeConfig,
} from "@mediapeek/shared/runtime-config"
import {
  createRootRoute,
  HeadContent,
  Link,
  Scripts,
} from "@tanstack/react-router"
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools"
import { Match } from "effect"
import type { ReactNode } from "react"

import { Footer } from "~/components/footer"
import { Header } from "~/components/header"
import { RouteAnnouncer } from "~/components/route-announcer"
import { ThemeProvider, useTheme } from "~/components/theme-provider"
import { Toaster } from "~/components/ui/sonner"
import { TooltipProvider } from "~/components/ui/tooltip"
import { useMediaQuery } from "~/hooks/use-media-query"
import type { MediaPeekRequestContext } from "~/lib/server-request-context"

import appCss from "../app.css?url"

const DEFAULT_PUBLIC_ENVIRONMENT = {
  TURNSTILE_ENABLED: false,
  APP_ENV: "production",
}

const rootLoader = async ({
  serverContext,
}: {
  serverContext?: MediaPeekRequestContext
}) => {
  if (serverContext === undefined) {
    if (typeof window === "undefined") {
      throw new Error(
        "MediaPeek request context was not provided to the root loader"
      )
    }

    return { env: window.ENV }
  }

  const { TURNSTILE_SITE_KEY } = serverContext.env
  const { turnstileEnabled, appEnv } = serverContext.runtimeConfig

  const publicEnvironment = {
    TURNSTILE_ENABLED: turnstileEnabled,
    APP_ENV: appEnv,
  }

  return turnstileEnabled
    ? {
        env: {
          ...publicEnvironment,
          TURNSTILE_SITE_KEY: TURNSTILE_SITE_KEY?.trim() ?? "",
        },
      }
    : { env: publicEnvironment }
}

const NotFoundPage = () => (
  <div className="flex min-h-screen flex-col font-sans">
    <Header />
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-4 py-16 text-center sm:px-12">
      <p className="text-muted-foreground text-sm tracking-wider uppercase">
        404
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
        Page not found
      </h1>
      <p className="text-muted-foreground mt-4 max-w-xl text-base leading-relaxed">
        The requested URL does not exist or is no longer available.
      </p>
      <p className="mt-8">
        <Link className="underline underline-offset-2" to="/" viewTransition>
          Back to MediaPeek Home
        </Link>
      </p>
    </main>
    <Footer />
    <title>404 - MediaPeek</title>
  </div>
)

const RootErrorBoundary = ({ error }: { error: unknown }) => {
  const rootEnvironment =
    Route.useLoaderData()?.env ?? DEFAULT_PUBLIC_ENVIRONMENT

  const showStack = isDevelopmentEnvironment(
    resolveRuntimeConfig({ APP_ENV: rootEnvironment.APP_ENV }).appEnv
  )

  const message = "Error"
  let details = "An unexpected error occurred."
  let stack: string | undefined

  if (showStack && error instanceof Error) {
    const { message: errorMessage, stack: errorStack } = error
    details = errorMessage
    stack = errorStack
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
  )
}

const RootDocumentContent = ({ children }: { children: ReactNode }) => {
  const env = Route.useLoaderData()?.env ?? DEFAULT_PUBLIC_ENVIRONMENT

  const { theme } = useTheme()
  const isMobile = useMediaQuery("(max-width: 640px)")

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        {Match.value(theme).pipe(
          Match.when("light", () => (
            <link
              rel="icon"
              type="image/png"
              sizes="32x32"
              href="/favicon-dark-32x32.png"
            />
          )),
          Match.when("dark", () => (
            <link
              rel="icon"
              type="image/png"
              sizes="32x32"
              href="/favicon-light-32x32.png"
            />
          )),
          Match.orElse(() => (
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
          ))
        )}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.ENV = ${JSON.stringify(env)}`,
          }}
        />
        {env.TURNSTILE_ENABLED ? (
          <script
            src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
            async
            defer
          />
        ) : null}
      </head>
      <body className="bg-background text-foreground antialiased">
        <div className="w-full" vaul-drawer-wrapper="">
          <TooltipProvider>
            {children}
            <Toaster position={isMobile ? "top-center" : "bottom-right"} />
          </TooltipProvider>
        </div>
        <RouteAnnouncer />
        <Scripts />
        {import.meta.env.DEV ? <TanStackRouterDevtools /> : null}
      </body>
    </html>
  )
}

const RootDocument = ({ children }: { children: ReactNode }) => (
  <ThemeProvider defaultTheme="system" storageKey="theme">
    <RootDocumentContent>{children}</RootDocumentContent>
  </ThemeProvider>
)

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "apple-touch-icon", href: "/ios-home-screen-icon.png" },
    ],
  }),
  loader: rootLoader,
  notFoundComponent: NotFoundPage,
  errorComponent: RootErrorBoundary,
  shellComponent: RootDocument,
})
