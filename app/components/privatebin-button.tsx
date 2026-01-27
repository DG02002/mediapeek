import { AlertCircle, Check, Shield } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '~/components/ui/button';

import { safeClipboardWrite } from '../lib/clipboard';
import { uploadToPrivateBin } from '../lib/privatebin';

interface PrivateBinButtonProps {
  content: string;
}

export function PrivateBinButton({ content }: PrivateBinButtonProps) {
  const [status, setStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');
  const [link, setLink] = useState<string | null>(null);

  const handleShare = () => {
    if (!content) return;

    const uploadPromise = (async () => {
      setStatus('loading');
      try {
        const { url } = await uploadToPrivateBin(content);
        setLink(url);
        setStatus('success');
        return url;
      } catch (err) {
        console.error('PrivateBin upload failed:', err);
        setStatus('error');
        setTimeout(() => {
          setStatus('idle');
        }, 3000);
        throw err;
      }
    })();

    void safeClipboardWrite(
      uploadPromise,
      () => {
        toast.success('Link Copied', {
          description: 'The secure link has been copied to your clipboard.',
        });
      },
      (err: unknown) => {
        // Error handling is primarily done within the uploadPromise
        console.error('Safe clipboard write failed', err);
      },
    );
  };

  const handleCopyAgain = async () => {
    if (link) {
      await navigator.clipboard.writeText(link);
      toast.success('Link Copied', {
        description: 'The secure link has been copied to your clipboard.',
      });
    }
  };

  return (
    <div className="flex items-center">
      <AnimatePresence mode="wait">
        {status === 'idle' && (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Button
              variant="outline"
              size="sm"
              onClick={handleShare}
              title="Share secure, self-destructing link via PrivateBin"
            >
              <Shield className="mr-2 h-4 w-4" />
              Share with PrivateBin
            </Button>
          </motion.div>
        )}

        {status === 'loading' && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Button variant="outline" size="sm" disabled>
              <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Encrypting...
            </Button>
          </motion.div>
        )}

        {status === 'success' && (
          <motion.div
            key="success"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void handleCopyAgain();
              }}
              className="text-primary hover:text-primary/80"
            >
              <Check className="mr-2 h-4 w-4" />
              Copy PrivateBin Link
            </Button>
          </motion.div>
        )}

        {status === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Button variant="destructive" size="sm" disabled>
              <AlertCircle className="mr-2 h-4 w-4" />
              Upload Failed
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
