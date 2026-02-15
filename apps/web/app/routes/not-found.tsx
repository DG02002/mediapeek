import { data, Link } from 'react-router';

import { Footer } from '~/components/footer';
import { Header } from '~/components/header';

import type { Route } from './+types/not-found';

export const loader = () => data(null, { status: 404 });

export const meta: Route.MetaFunction = () => {
  return [{ title: '404 - Not Found' }];
};

export default function NotFoundRoute() {
  return (
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
    </div>
  );
}
