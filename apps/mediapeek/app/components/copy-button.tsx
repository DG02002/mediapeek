import { ClipboardIcon, Tick01Icon } from '@hugeicons/core-free-icons';
import { Button } from '@mediapeek/ui/components/button';
import { Icon } from '@mediapeek/ui/components/icon';
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
      aria-label={copied ? 'Copied to clipboard' : 'Copy to clipboard'}
      title="Copy to clipboard"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={copied ? 'copied' : 'idle'}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.5, opacity: 0 }}
          transition={QuickTransition}
          className={
            copied
              ? 'text-emerald-400'
              : 'text-muted-foreground group-hover:text-foreground transition-colors'
          }
        >
          <Icon
            icon={ClipboardIcon}
            altIcon={Tick01Icon}
            showAlt={copied}
            size={16}
          />
        </motion.div>
      </AnimatePresence>
    </Button>
  );
}
