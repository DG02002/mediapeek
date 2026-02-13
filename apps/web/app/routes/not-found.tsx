import { Link } from 'react-router';

import type { Route } from './+types/not-found';

export const loader = () =>
  new Response('Not Found', {
    status: 404,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
    },
  });

export const meta: Route.MetaFunction = () => {
  return [{ title: '404 - Not Found' }];
};

export default function NotFoundRoute() {
  return (
    <main className="container mx-auto p-6">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-muted-foreground mt-2">
        The URL you requested does not exist.
      </p>
      <p className="mt-4">
        <Link className="underline underline-offset-2" to="/">
          Back to MediaPeek
        </Link>
      </p>
    </main>
  );
}
