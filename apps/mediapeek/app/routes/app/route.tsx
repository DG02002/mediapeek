import type { Route } from './+types/route';

import { Footer } from '~/components/footer';
import { Header } from '~/components/header';
import { MediaForm } from '~/components/media-form';
import { useHydrated } from '~/hooks/use-hydrated';

export const meta: Route.MetaFunction = () => {
  return [
    { title: 'App - MediaPeek' },
    {
      name: 'description',
      content:
        'Analyze media files directly in your browser using Cloudflare Workers and MediaInfo.js.',
    },
  ];
};

export default function AppRoute() {
  const isHydrated = useHydrated();

  return (
    <div className="flex min-h-screen flex-col font-sans">
      <Header sticky={false} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-12 sm:px-12">
        {isHydrated ? (
          <MediaForm />
        ) : (
          <div className="flex w-full max-w-3xl animate-pulse flex-col gap-8 py-8">
            <div className="bg-muted/20 h-32 w-full rounded-lg" />
            <div className="bg-muted/20 h-64 w-full rounded-lg" />
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
