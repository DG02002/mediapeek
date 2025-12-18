import type { MetaFunction } from 'react-router';

import { MediaForm } from '../components/media-form';

export const meta: MetaFunction = () => {
  return [
    { title: 'MediaPeek' },
    {
      name: 'description',
      content:
        'Analyze media files directly in your browser using Cloudflare Workers proxy and MediaInfo.js',
    },
  ];
};

export default function Index() {
  return (
    <div className="flex min-h-screen flex-col font-sans">
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-start px-4 pt-4 lg:px-8">
        <MediaForm />
      </main>
      <footer className="bg-muted/50 border-t backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
          <p className="text-muted-foreground text-center text-sm font-medium">
            Hosted on{' '}
            <a
              href="https://workers.cloudflare.com/"
              target="_blank"
              rel="noreferrer"
              className="hover:text-foreground underline underline-offset-4 transition-colors"
            >
              Cloudflare Workers
            </a>{' '}
            • Powered by{' '}
            <a
              href="https://mediainfo.js.org/"
              target="_blank"
              rel="noreferrer"
              className="hover:text-foreground underline underline-offset-4 transition-colors"
            >
              MediaInfo WebAssembly
            </a>{' '}
            • Build: {__BUILD_NUMBER__}
          </p>
        </div>
      </footer>
    </div>
  );
}
