import { buttonVariants } from '@mediapeek/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@mediapeek/ui/components/card';
import { cn } from '@mediapeek/ui/lib/utils';
import { Link } from 'react-router';

import { Footer } from '~/components/footer';
import { Header } from '~/components/header';
import { TrademarkNotice } from '~/components/media-view/trademark-notice';
import { MEDIA_CONSTANTS } from '~/lib/media/constants';

import type { Route } from './+types/route';

export const meta: Route.MetaFunction = () => {
  return [
    { title: 'MediaPeek' },
    {
      name: 'description',
      content:
        'Inspect media metadata from URL sources in a clear and reliable interface.',
    },
  ];
};

const features = [
  {
    id: 'edge-analysis',
    title: 'Edge Analysis',
    summary:
      'Fetches only necessary data segments without downloading the entire file.',
    points: [
      'Optimized for byte-range requests to reduce transfer and wait time.',
      'Built for large assets where full downloads are wasteful.',
      'Processing runs on edge infrastructure close to users.',
    ],
  },
  {
    id: 'archive-extraction',
    title: 'Archive Extraction',
    summary:
      'Transparently unpacks media from common archives while preserving file context.',
    points: [
      'ZIP support: Stored and DEFLATE-compressed archives.',
      'TAR support: Standard tar archives including @LongLink extended headers.',
      'Displays archive name alongside inner filename for clear provenance.',
    ],
  },
  {
    id: 'supported-sources',
    title: 'Supported Sources',
    summary:
      'Works with modern remote media sources used by developers and everyday users.',
    points: [
      'Web servers: HTTP/HTTPS URLs with byte-range optimization.',
      'Google Drive: Public files and folders.',
    ],
  },
  {
    id: 'secure-sharing',
    title: 'Secure Sharing',
    summary: 'Share results with end-to-end encryption through PrivateBin.',
    points: ['Sharing flow is designed for privacy-first collaboration.'],
  },
  {
    id: 'output-formats',
    title: 'Output Formats',
    summary:
      'Export metadata in multiple formats for analysis, automation, or archival.',
    points: [
      'Supported outputs: Object, JSON, Text, HTML, XML.',
      'Readable formats help non-technical users review file properties.',
    ],
  },
] as const;

const badges = [
  'dolby-vision',
  'dolby-atmos',
  'hdr',
  'hdr10-plus',
  '4k',
  'hd',
  'imax',
  'dts',
  'dts-x',
  'hi-res-lossless',
  'apple-digital-master',
  'aac',
  'cc',
  'sdh',
] as const;

const trademarkBadges = [
  MEDIA_CONSTANTS.BADGES.DOLBY_VISION,
  MEDIA_CONSTANTS.BADGES.DOLBY_ATMOS,
  MEDIA_CONSTANTS.BADGES.DOLBY_AUDIO,
  MEDIA_CONSTANTS.BADGES.IMAX,
  MEDIA_CONSTANTS.BADGES.DTS,
  MEDIA_CONSTANTS.BADGES.DTS_X,
  MEDIA_CONSTANTS.BADGES.HDR10_PLUS,
  MEDIA_CONSTANTS.BADGES.AV1,
];

const METADATA_ENGINE = {
  mediainfoJs: {
    version: '0.3.7',
    url: 'https://mediainfo.js.org/',
  },
  mediaInfoLib: {
    version: '25.10',
    url: 'https://github.com/MediaArea/MediaInfoLib',
  },
} as const;

function GithubBrandIcon() {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5 fill-current"
      aria-hidden="true"
    >
      <path d="M12 .297C5.373.297 0 5.67 0 12.297c0 5.303 3.438 9.8 8.205 11.386.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.725-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.758-1.333-1.758-1.09-.744.082-.729.082-.729 1.205.085 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.418-1.305.762-1.604-2.665-.303-5.466-1.333-5.466-5.93 0-1.31.468-2.38 1.235-3.22-.123-.303-.535-1.524.117-3.176 0 0 1.008-.323 3.3 1.23a11.5 11.5 0 0 1 3.003-.404c1.02.005 2.047.138 3.005.404 2.29-1.553 3.297-1.23 3.297-1.23.653 1.653.241 2.874.118 3.176.77.84 1.234 1.91 1.234 3.22 0 4.61-2.805 5.624-5.478 5.921.43.372.814 1.103.814 2.223 0 1.606-.015 2.898-.015 3.293 0 .321.216.694.825.576C20.565 22.092 24 17.592 24 12.297 24 5.67 18.627.297 12 .297z" />
    </svg>
  );
}

export default function HomeRoute() {
  return (
    <div className="flex min-h-screen flex-col font-sans">
      <Header />
      <main className="flex-1">
        <section className="from-muted/35 to-background bg-linear-to-b">
          <div className="mx-auto flex w-full max-w-5xl flex-col items-center px-4 py-16 text-center sm:px-12 sm:py-24">
            <div className="relative h-28 w-28 sm:h-32 sm:w-32">
              <img
                src="/badges/icon-light.webp"
                alt="MediaPeek Logo"
                className="hidden h-full w-full object-contain dark:block"
              />
              <img
                src="/badges/icon-dark.webp"
                alt="MediaPeek Logo"
                className="h-full w-full object-contain dark:hidden"
              />
            </div>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-6xl">
              MediaPeek
            </h1>
            <p className="text-muted-foreground mt-5 max-w-3xl text-lg leading-relaxed sm:text-xl">
              Inspect media metadata from URL sources in a clear and reliable
              interface.
            </p>
            <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
              <Link
                to="/app"
                viewTransition
                className={cn(buttonVariants({ size: 'lg' }), 'min-w-40')}
              >
                Open App
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-5xl px-4 pt-0 pb-16 sm:px-12 sm:pb-20">
          <div className="from-muted/30 to-background isolate overflow-hidden rounded-3xl border bg-linear-to-b p-2 shadow-sm sm:p-3">
            <div className="bg-background overflow-hidden rounded-2xl border">
              <iframe
                src="/preview"
                title="MediaPeek Preview"
                className="h-[920px] w-full bg-transparent"
                loading="lazy"
              />
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-5xl px-4 pb-16 sm:px-12 sm:pb-20">
          <div className="mb-8">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Key Features
            </h2>
            <p className="text-muted-foreground mt-3 max-w-3xl text-lg leading-relaxed">
              Clean, high-density feature summaries with technical depth built
              directly into the layout.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {features.map((feature, idx) => (
              <Card
                key={feature.id}
                className={cn(
                  'border-border/70 bg-background/90',
                  idx === 0 && 'md:col-span-2',
                )}
              >
                <CardHeader className="border-b pb-6">
                  <p className="text-muted-foreground text-xs font-medium tracking-[0.2em] uppercase">
                    Feature {String(idx + 1).padStart(2, '0')}
                  </p>
                  <CardTitle
                    className={cn(
                      'tracking-tight',
                      idx === 0 ? 'text-3xl' : 'text-2xl',
                    )}
                  >
                    {feature.title}
                  </CardTitle>
                  <CardDescription className="text-base leading-relaxed">
                    {feature.summary}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div
                    className={cn(
                      'grid gap-3',
                      idx === 0 ? 'sm:grid-cols-3' : 'sm:grid-cols-1',
                    )}
                  >
                    {feature.points.map((point) => (
                      <div
                        key={point}
                        className="bg-muted/35 rounded-xl border px-4 py-3 text-sm leading-relaxed"
                      >
                        {point}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-5xl px-4 pb-16 sm:px-12 sm:pb-20">
          <Card className="border-border/70 from-muted/25 to-background bg-linear-to-b">
            <CardHeader>
              <CardTitle className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Format badges
              </CardTitle>
              <CardDescription className="max-w-3xl text-base leading-relaxed">
                Carefully extracted badge assets inspired by Apple TV and other
                platforms for consistent, high-fidelity media labeling.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                {badges.map((badge) => (
                  <div
                    key={badge}
                    className="bg-background/70 flex items-center justify-center rounded-xl border p-4"
                  >
                    <img
                      src={`/badges/${badge}.svg`}
                      alt={`${badge} badge`}
                      className="h-6 w-auto object-contain grayscale dark:invert"
                      loading="lazy"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mx-auto w-full max-w-5xl px-4 pb-16 sm:px-12 sm:pb-20">
          <Card className="border-border/70 from-muted/20 to-background bg-linear-to-b">
            <CardHeader className="border-b pb-5">
              <div className="flex items-center gap-4">
                <img
                  src="/badges/mediainfo.svg"
                  alt="MediaInfo Logo"
                  className="h-14 w-14 object-contain"
                />
                <div>
                  <CardTitle className="text-2xl font-semibold tracking-tight">
                    Metadata Engine
                  </CardTitle>
                  <CardDescription className="max-w-3xl text-base leading-relaxed">
                    <a
                      href={METADATA_ENGINE.mediainfoJs.url}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-foreground underline underline-offset-4 transition-colors"
                    >
                      mediainfo.js v{METADATA_ENGINE.mediainfoJs.version}
                    </a>{' '}
                    /{' '}
                    <a
                      href={METADATA_ENGINE.mediaInfoLib.url}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-foreground underline underline-offset-4 transition-colors"
                    >
                      MediaInfoLib v{METADATA_ENGINE.mediaInfoLib.version}
                    </a>
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground text-sm leading-relaxed">
                MediaPeek uses mediainfo.js as the metadata analysis layer. The
                library runs through WebAssembly and is based on MediaInfoLib.
              </p>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Analysis by mediainfo.js, a WebAssembly port of MediaInfo
                library, Copyright (c) 2002-2026 MediaArea.net SARL.
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="mx-auto w-full max-w-5xl px-4 pb-16 sm:px-12 sm:pb-20">
          <Card className="border-border/70">
            <CardHeader>
              <CardTitle className="text-2xl font-semibold tracking-tight">
                Open Source
              </CardTitle>
              <CardDescription className="max-w-3xl text-base leading-relaxed">
                MediaPeek is open source. Explore the codebase, report issues,
                and contribute improvements.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <a
                href="https://github.com/DG02002/mediapeek"
                target="_blank"
                rel="noreferrer"
                className={cn(buttonVariants({ size: 'lg' }), 'min-w-48 gap-2')}
              >
                <GithubBrandIcon />
                Visit GitHub Repository
              </a>
            </CardContent>
          </Card>
        </section>

        <section className="mx-auto w-full max-w-5xl px-4 pb-16 sm:px-12 sm:pb-20">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Trademark & Attribution Notices
          </h2>
          <div className="text-muted-foreground mt-4 space-y-3 text-xs leading-relaxed">
            <p>
              Apple Services badges are sourced from Apple TV and Apple Music.
            </p>
          </div>
          <TrademarkNotice badges={trademarkBadges} />
        </section>
      </main>
      <Footer />
    </div>
  );
}
