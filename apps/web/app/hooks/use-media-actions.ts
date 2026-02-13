import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';

import { safeClipboardWrite } from '../lib/clipboard';
import { uploadToPrivateBin } from '../lib/privatebin';
import { useHapticFeedback } from './use-haptic';

interface UseMediaActionsProps {
  data: Record<string, string>;
  url: string;
}

export function useMediaActions({ data, url }: UseMediaActionsProps) {
  const fetchedData = useRef<Record<string, string>>({});
  const sharedUrls = useRef<Record<string, string>>({});
  const { triggerSuccess } = useHapticFeedback();
  const [isSharing, setIsSharing] = useState(false);

  const fetchContent = useCallback(
    async (format: string, label: string) => {
      let content: string | undefined =
        data[format] ?? fetchedData.current[format];

      if (!content) {
        const toastId = toast.loading(`Generating ${label}...`);
        try {
          const response = await fetch(
            `/resource/analyze?url=${encodeURIComponent(url)}&format=${format}`,
          );
          if (!response.ok) throw new Error('Failed to generate format');
          const json: {
            success?: boolean;
            results?: Record<string, string>;
            error?: { message?: string } | string;
          } = await response.json();
          if (json.success === false) {
            throw new Error(
              typeof json.error === 'string'
                ? json.error
                : (json.error?.message ?? 'Failed to generate format'),
            );
          }
          content = json.results?.[format];
          if (!content) throw new Error('No content returned');

          fetchedData.current[format] = content;
          toast.dismiss(toastId);
        } catch (err) {
          console.error(err);
          toast.error(`Failed to generate ${label}`, { id: toastId });
          return null;
        }
      }
      if (format === 'json' && content) {
        try {
          const parsed = JSON.parse(content);
          return JSON.stringify(parsed, null, 2);
        } catch {
          // If parsing fails, return original content
        }
      }
      return content;
    },
    [data, url],
  );

  const handleCopy = useCallback(
    (format: string, label: string) => {
      const contentPromise = fetchContent(format, label).then(
        (content: string | null | undefined) => {
          if (!content) {
            if (content === undefined) toast.error(`No ${label} data found.`);
            throw new Error('No content found');
          }
          return content;
        },
      );

      void safeClipboardWrite(
        contentPromise,
        () => {
          triggerSuccess();
          toast.success('Copied to clipboard', {
            description: `${label} format copied successfully.`,
            duration: 2000,
          });
        },
        (err: unknown) => {
          console.error('Failed to copy', err);
        },
      );
    },
    [fetchContent, triggerSuccess],
  );

  const getShareUrl = useCallback(
    async (format: string, label: string) => {
      // Return cached URL if available
      if (sharedUrls.current[format]) {
        return sharedUrls.current[format];
      }

      const content = await fetchContent(format, label);

      if (!content) {
        if (typeof content === 'undefined')
          toast.error(`No ${label} data found.`);
        throw new Error('No content found');
      }

      const toastId = toast.loading(`Encrypting & Uploading ${label}...`);
      setIsSharing(true);

      try {
        const { url: newUrl } = await uploadToPrivateBin(content);
        sharedUrls.current[format] = newUrl;
        toast.dismiss(toastId);
        return newUrl;
      } catch (err) {
        console.error('PrivateBin upload failed:', err);
        toast.error('Upload Failed', {
          id: toastId,
          description: 'Could not upload to PrivateBin. Please try again.',
        });
        throw err;
      } finally {
        setIsSharing(false);
      }
    },
    [fetchContent],
  );

  return { handleCopy, getShareUrl, isSharing };
}
