import { ChevronDown, Copy } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '~/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';

interface CopyMenuProps {
  data: Record<string, string>;
  className?: string;
}

export function CopyMenu({ data, className }: CopyMenuProps) {
  const handleCopy = async (format: string, label: string) => {
    const content = data[format];
    if (!content) {
      toast.error(`No ${label} data found.`);
      return;
    }

    try {
      await navigator.clipboard.writeText(content);
      toast.success('Copied to clipboard', {
        description: `${label} format copied successfully.`,
        duration: 2000,
      });
    } catch (err) {
      console.error('Failed to copy', err);
      toast.error('Failed to copy', {
        description: 'Please try again.',
      });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm" className={className}>
          <Copy className="mr-2 h-4 w-4" />
          Copy
          <ChevronDown className="ml-2 h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleCopy('text', 'Text')}>
          Copy Text
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleCopy('json', 'JSON')}>
          Copy JSON
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleCopy('html', 'HTML')}>
          Copy HTML
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleCopy('xml', 'XML')}>
          Copy XML
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
