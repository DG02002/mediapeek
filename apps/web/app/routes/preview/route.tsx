import { MediaView } from '~/components/media-view';
import { homeDemoFixture } from '~/lib/home-demo-fixture';

import type { Route } from './+types/route';

export const meta: Route.MetaFunction = () => [
  { title: 'Preview - MediaPeek' },
  {
    name: 'robots',
    content: 'noindex, nofollow',
  },
];

interface DemoPayload {
  creatingLibrary?: {
    name?: string;
    version?: string;
    url?: string;
  };
  media?: {
    track?: Array<Record<string, unknown>>;
  };
}

function isDemoPayload(value: unknown): value is DemoPayload {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  if (!record.media || typeof record.media !== 'object') return false;
  const media = record.media as Record<string, unknown>;
  return Array.isArray(media.track);
}

function enhancePreviewBadges(data: DemoPayload): DemoPayload {
  const clone = structuredClone(data) as DemoPayload;
  const tracks = clone.media?.track ?? [];

  const generalTrack =
    tracks.find((track) => track['@type'] === 'General') ??
    (() => {
      const created: Record<string, unknown> = { '@type': 'General' };
      tracks.push(created);
      return created;
    })();

  const completeName =
    typeof generalTrack.CompleteName === 'string'
      ? generalTrack.CompleteName
      : 'MediaPeek.Demo.mkv';
  if (!completeName.toUpperCase().includes('IMAX')) {
    generalTrack.CompleteName = completeName.replace(/\.mkv$/i, '.IMAX.mkv');
  }

  const videoTrack =
    tracks.find((track) => track['@type'] === 'Video') ??
    (() => {
      const created: Record<string, unknown> = { '@type': 'Video' };
      tracks.push(created);
      return created;
    })();
  videoTrack.HDR_Format = 'Dolby Vision';
  videoTrack.HDR_Format_Compatibility = '';
  videoTrack.DisplayAspectRatio = 1.9;

  const audioTrack =
    tracks.find((track) => track['@type'] === 'Audio') ??
    (() => {
      const created: Record<string, unknown> = { '@type': 'Audio' };
      tracks.push(created);
      return created;
    })();
  audioTrack.Format = 'FLAC';
  audioTrack.Title = 'Hi-Res Lossless';
  audioTrack.BitDepth = 24;
  audioTrack.SamplingRate = 96000;
  audioTrack.Compression_Mode = 'Lossless';

  const textTrack =
    tracks.find((track) => track['@type'] === 'Text') ??
    (() => {
      const created: Record<string, unknown> = { '@type': 'Text' };
      tracks.push(created);
      return created;
    })();
  textTrack.Title = 'CC';
  textTrack.Format = 'UTF-8';

  return clone;
}

export async function loader({ request }: Route.LoaderArgs) {
  const demoUrl = new URL('/demo.json', request.url);

  try {
    const response = await fetch(demoUrl);
    if (!response.ok) {
      throw new Error(`Failed to load demo.json (${String(response.status)})`);
    }

    const data = (await response.json()) as unknown;
    if (!isDemoPayload(data)) {
      throw new Error('Invalid demo.json shape.');
    }

    const enhancedData = enhancePreviewBadges(data);

    const generalTrack = enhancedData.media?.track?.find(
      (track) => track['@type'] === 'General',
    );
    const completeName =
      typeof generalTrack?.CompleteName === 'string'
        ? generalTrack.CompleteName
        : undefined;

    return {
      sourceUrl: completeName ?? homeDemoFixture.sourceUrl,
      object: enhancedData,
      json: JSON.stringify(enhancedData, null, 2),
      text: homeDemoFixture.results.text,
    };
  } catch {
    return {
      sourceUrl: homeDemoFixture.sourceUrl,
      object: homeDemoFixture.results.object,
      json: homeDemoFixture.results.json,
      text: homeDemoFixture.results.text,
    };
  }
}

export default function PreviewRoute({ loaderData }: Route.ComponentProps) {
  const previewResults: Record<string, string> = {
    object: JSON.stringify(loaderData.object, null, 2),
    json: loaderData.json,
    text: loaderData.text,
  };

  return (
    <main className="bg-background min-h-screen px-4 py-4 sm:px-8">
      <MediaView data={previewResults} url={loaderData.sourceUrl} />
    </main>
  );
}
