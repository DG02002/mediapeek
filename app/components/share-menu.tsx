import { ChevronDown, ExternalLink, Share } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '~/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';

import { uploadToPrivateBin } from '../lib/privatebin';

interface ShareMenuProps {
  data: Record<string, string>;
  className?: string;
}

export function ShareMenu({ data, className }: ShareMenuProps) {
  const [url, setUrl] = useState<string | null>(null);

  const handleShare = async (format: string, label: string) => {
    const content = data[format];
    if (!content) {
      toast.error(`No ${label} data found.`);
      return;
    }

    const toastId = toast.loading(`Encrypting & Uploading ${label}...`);

    try {
      const { url: newUrl } = await uploadToPrivateBin(content);

      await navigator.clipboard.writeText(newUrl);
      setUrl(newUrl);

      toast.success('Link Copied', {
        id: toastId,
        description: `Secure ${label} link copied to clipboard.`,
        duration: 4000,
      });
    } catch (err) {
      console.error('PrivateBin upload failed:', err);
      toast.error('Upload Failed', {
        id: toastId,
        description: 'Could not upload to PrivateBin. Please try again.',
      });
    }
  };

  if (url) {
    return (
      <Button
        variant="secondary"
        size="sm"
        className={className}
        onClick={() => window.open(url, '_blank')}
      >
        <ExternalLink className="mr-2 h-4 w-4" />
        Open in PrivateBin
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm" className={className}>
          <Share className="mr-2 h-4 w-4" />
          Share
          <ChevronDown className="ml-2 h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleShare('text', 'Text')}>
          Share Text
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleShare('json', 'JSON')}>
          Share JSON
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleShare('html', 'HTML')}>
          Share HTML
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleShare('xml', 'XML')}>
          Share XML
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
