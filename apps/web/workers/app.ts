import { createRequestHandler } from 'react-router';

declare module 'react-router' {
  export interface AppLoadContext {
    cloudflare: {
      env: Env;
      ctx: ExecutionContext;
    };
  }
}

const requestHandler = createRequestHandler(
  () => import('virtual:react-router/server-build'),
  import.meta.env.MODE,
);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    const analyzerBaseUrl = env.ANALYZE_API_BASE_URL?.trim();
    if (analyzerBaseUrl && url.pathname === '/resource/analyze') {
      const target = new URL('/resource/analyze', analyzerBaseUrl);
      target.search = url.search;

      const proxyRequest = new Request(target.toString(), request);
      if (env.ANALYZE_API_KEY) {
        proxyRequest.headers.set('x-api-key', env.ANALYZE_API_KEY);
      }

      return fetch(proxyRequest);
    }

    // Proxy logic
    // console.log("Incoming request:", url.pathname, url.searchParams.toString());
    if (
      url.pathname === '/resources/proxy' ||
      url.pathname.startsWith('/resources/proxy')
    ) {
      const targetUrl = url.searchParams.get('url');

      // CORS headers
      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Range, Content-Type, User-Agent',
        'Access-Control-Expose-Headers':
          'Content-Length, Content-Range, Content-Type, Accept-Ranges, Content-Disposition',
      };

      if (request.method === 'OPTIONS') {
        return new Response(null, {
          headers: corsHeaders,
        });
      }

      if (!targetUrl) {
        return new Response("Missing 'url' query parameter", {
          status: 400,
          headers: corsHeaders,
        });
      }

      try {
        const upstreamUrl = new URL(targetUrl);
        // Basic validation
        if (!['http:', 'https:'].includes(upstreamUrl.protocol)) {
          return new Response('Invalid protocol', {
            status: 400,
            headers: corsHeaders,
          });
        }

        const upstreamHeaders = new Headers();

        // 1. Critical: Always forward the Range header if present
        const range = request.headers.get('Range');
        if (range) {
          upstreamHeaders.set('Range', range);
        }

        // 2. Browser Emulation Headers (Hardcoded to mimic Chrome/macOS as requested)
        upstreamHeaders.set(
          'accept',
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        );
        upstreamHeaders.set('accept-language', 'en-US,en;q=0.9');
        upstreamHeaders.set('priority', 'u=0, i');
        upstreamHeaders.set(
          'sec-ch-ua',
          '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
        );
        upstreamHeaders.set('sec-ch-ua-mobile', '?0');
        upstreamHeaders.set('sec-ch-ua-platform', '"macOS"');
        upstreamHeaders.set('sec-fetch-dest', 'document');
        upstreamHeaders.set('sec-fetch-mode', 'navigate');
        upstreamHeaders.set('sec-fetch-site', 'none');
        upstreamHeaders.set('sec-fetch-user', '?1');
        upstreamHeaders.set('upgrade-insecure-requests', '1');
        upstreamHeaders.set(
          'user-agent',
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
        );

        const upstreamResponse = await fetch(upstreamUrl.toString(), {
          method: request.method,
          headers: upstreamHeaders,
          redirect: 'follow',
        });

        // Create response headers to forward
        const responseHeaders = new Headers();

        // Copy upstream headers but filter out hop-by-hop or problematic ones
        const skipHeaders = [
          'content-encoding', // Let the worker/browser handle this
          'content-security-policy',
          'access-control-allow-origin', // We set our own
          'transfer-encoding',
          'connection',
          'keep-alive',
        ];

        for (const [key, value] of upstreamResponse.headers.entries()) {
          if (!skipHeaders.includes(key.toLowerCase())) {
            responseHeaders.set(key, value);
          }
        }

        // Ensure CORS headers are set/overwritten
        Object.entries(corsHeaders).forEach(([key, value]) => {
          responseHeaders.set(key, value);
        });

        // Strictly check for Range support if we requested it
        // If we requested bytes=0-100 and got 200 OK (full file), we might want to warn or error?
        // But for stream passthrough, we just return what we got.
        // The client-side (mediainfo.ts) logic will now handle the 200 vs 206 check and abort if needed.

        return new Response(upstreamResponse.body, {
          status: upstreamResponse.status,
          statusText: upstreamResponse.statusText,
          headers: responseHeaders,
        });
      } catch (error) {
        return new Response(
          `Proxy error: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
          {
            status: 502,
            headers: corsHeaders,
          },
        );
      }
    }

    // Default React Router handler
    try {
      return await requestHandler(request, {
        cloudflare: { env, ctx },
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('No route matches URL')
      ) {
        console.warn(
          JSON.stringify({
            severity: 'WARNING',
            errorClass: 'ROUTE_NOT_FOUND',
            requestId: request.headers.get('cf-ray') ?? crypto.randomUUID(),
            message: error.message,
            path: url.pathname,
          }),
        );
        return new Response('Not Found', { status: 404 });
      }
      throw error;
    }
  },
} satisfies ExportedHandler<Env>;
