import { ClipboardIcon, Tick01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { Button } from '@mediapeek/ui/components/button';
import { QuickTransition } from '@mediapeek/ui/lib/animation';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';

interface CopyButtonProps {
  content: string;
  className?: string;
}

export function CopyButton({ content, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard', err);
    }
  };

  return (
    <Button
      variant="secondary"
      size="icon"
      onClick={() => {
        void handleCopy();
      }}
      className={className}
      title="Copy to clipboard"
    >
      <AnimatePresence mode="wait" initial={false}>
        {copied ? (
          <motion.div
            key="check"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={QuickTransition}
            className="text-emerald-400"
          >
            <HugeiconsIcon icon={Tick01Icon} size={16} />
          </motion.div>
        ) : (
          <motion.div
            key="copy"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={QuickTransition}
            className="text-muted-foreground group-hover:text-foreground transition-colors"
          >
            <HugeiconsIcon icon={ClipboardIcon} size={16} />
          </motion.div>
        )}
      </AnimatePresence>
    </Button>
  );
}
