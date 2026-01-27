import { Copy, FileText, MoreVertical, Quote, Share } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '~/components/ui/drawer';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Separator } from '~/components/ui/separator';
import { Switch } from '~/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { useMediaActions } from '~/hooks/use-media-actions';
import { useMediaQuery } from '~/hooks/use-media-query';

interface OptionsMenuProps {
  data: Record<string, string>;
  url: string;
  filename: string;
  isTextView: boolean;
  setIsTextView: (val: boolean) => void;
  showOriginalTitles: boolean;
  setShowOriginalTitles: (val: boolean) => void;
  className?: string;
  onShareSuccess?: (url: string) => void;
}

const formats = [
  { id: 'json', label: 'Object' },
  { id: 'json', label: 'JSON' },
  { id: 'text', label: 'Text' },
  { id: 'xml', label: 'XML' },
  { id: 'html', label: 'HTML' },
];

export function OptionsMenu({
  data,
  url,
  filename,
  isTextView,
  setIsTextView,
  showOriginalTitles,
  setShowOriginalTitles,
  className,
  onShareSuccess,
}: OptionsMenuProps) {
  const { handleCopy, getShareUrl } = useMediaActions({ data, url });
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [open, setOpen] = React.useState(false);

  const [shareDialogOpen, setShareDialogOpen] = React.useState(false);
  const [shareData, setShareData] = React.useState<{
    url: string;
    label: string;
  } | null>(null);

  const handleShareClick = async (format: string, label: string) => {
    try {
      const shareUrl = await getShareUrl(format, label);
      if (shareUrl) {
        setShareData({ url: shareUrl, label });
        setOpen(false); // Close the main menu first

        // Wait for drawer close animation to finish before opening dialog
        // This prevents layout thrashing and jitter on mobile
        setTimeout(() => {
          setShareDialogOpen(true);
          onShareSuccess?.(shareUrl);
        }, 300);
      }
    } catch {
      // Error is handled in getShareUrl (toast)
    }
  };

  const copyToClipboard = () => {
    if (shareData?.url) {
      void navigator.clipboard.writeText(shareData.url);
      toast.success('Link copied to clipboard');
    }
  };

  return (
    <>
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="items-start text-left">
            <DialogTitle>Link Created</DialogTitle>
            <DialogDescription>
              The <strong>{shareData?.label}</strong> metadata for this file has
              been encrypted:
            </DialogDescription>
            <div className="mt-1.5 mb-2 min-w-0 px-1 text-sm">
              <span className="text-foreground line-clamp-3 font-medium break-all">
                {filename}
              </span>
            </div>
          </DialogHeader>
          <div className="flex w-full items-center space-x-2">
            <div className="grid w-full min-w-0 flex-1 gap-2">
              <Label htmlFor="link" className="sr-only">
                Link
              </Label>
              <Input
                id="link"
                defaultValue={shareData?.url}
                readOnly
                className="w-full"
                tabIndex={-1}
              />
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-start">
            <Button
              type="submit"
              size="sm"
              className="w-full px-3 sm:w-auto"
              onClick={copyToClipboard}
            >
              <span className="sr-only">Copy</span>
              <span>Copy Link</span>
            </Button>
            <Button
              size="sm"
              variant="secondary"
              asChild
              className="w-full sm:w-auto"
            >
              <a
                href={shareData?.url}
                target="_blank"
                rel="noreferrer"
                className="px-3"
              >
                <span>Open</span>
              </a>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {isDesktop ? (
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className={className}>
              <MoreVertical className="h-5 w-5" />
              <span className="sr-only">Options</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setIsTextView(!isTextView);
              }}
            >
              <div className="flex flex-1 items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  {isTextView ? (
                    <FileText className="h-4 w-4" />
                  ) : (
                    <FileText className="h-4 w-4 opacity-50" />
                  )}
                  View as Text
                </span>
                <Switch checked={isTextView} />
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setShowOriginalTitles(!showOriginalTitles);
              }}
            >
              <div className="flex flex-1 items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  {showOriginalTitles ? (
                    <Quote className="h-4 w-4" />
                  ) : (
                    <Quote className="h-4 w-4 opacity-50" />
                  )}
                  Show Original Titles
                </span>
                <Switch checked={showOriginalTitles} />
              </div>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Copy className="mr-2 h-4 w-4" />
                <span>Copy Metadata</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-48">
                {formats.map((fmt, i) => (
                  <DropdownMenuItem
                    key={`${fmt.id}-${String(i)}`}
                    onClick={() => {
                      handleCopy(fmt.id, fmt.label);
                    }}
                  >
                    Copy {fmt.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Share className="mr-2 h-4 w-4" />
                <span>Share Metadata</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-48">
                {formats.map((fmt, i) => (
                  <DropdownMenuItem
                    key={`${fmt.id}-${String(i)}`}
                    onClick={() => {
                      void handleShareClick(fmt.id, fmt.label);
                    }}
                  >
                    Share {fmt.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerTrigger asChild>
            <Button variant="ghost" size="icon" className={className}>
              <MoreVertical className="h-5 w-5" />
              <span className="sr-only">Options</span>
            </Button>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader className="text-left">
              <DrawerTitle>Options</DrawerTitle>
              <DrawerDescription>
                Configure view settings and share content.
              </DrawerDescription>
            </DrawerHeader>
            <div className="grid gap-4 px-4 pb-8">
              <div className="flex items-center justify-between space-x-2">
                <Label
                  htmlFor="view-text"
                  className="flex items-center gap-2 font-normal"
                >
                  <FileText className="h-4 w-4" />
                  View as Text
                </Label>
                <Switch
                  id="view-text"
                  checked={isTextView}
                  onCheckedChange={setIsTextView}
                />
              </div>
              <div className="flex items-center justify-between space-x-2">
                <Label
                  htmlFor="show-titles"
                  className="flex items-center gap-2 font-normal"
                >
                  <Quote className="h-4 w-4" />
                  Show Original Titles
                </Label>
                <Switch
                  id="show-titles"
                  checked={showOriginalTitles}
                  onCheckedChange={setShowOriginalTitles}
                />
              </div>

              <Separator className="my-2" />

              <Tabs defaultValue="copy" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="copy">Copy</TabsTrigger>
                  <TabsTrigger value="share">Share</TabsTrigger>
                </TabsList>
                <TabsContent value="copy" className="mt-4">
                  <p className="text-muted-foreground mb-3 text-xs">
                    Select a format to copy metadata to clipboard.
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {formats.map((fmt, i) => (
                      <Button
                        key={`copy-${fmt.id}-${String(i)}`}
                        variant="ghost"
                        size="sm"
                        className="bg-muted/30 hover:bg-muted/50 border"
                        onClick={() => {
                          handleCopy(fmt.id, fmt.label);
                          setOpen(false);
                        }}
                      >
                        {fmt.label}
                      </Button>
                    ))}
                  </div>
                </TabsContent>
                <TabsContent value="share" className="mt-4">
                  <p className="text-muted-foreground mb-3 text-xs">
                    Select a format to secure share via PrivateBin.
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {formats.map((fmt, i) => (
                      <Button
                        key={`share-${fmt.id}-${String(i)}`}
                        variant="ghost"
                        size="sm"
                        className="bg-muted/30 hover:bg-muted/50 border"
                        onClick={() => {
                          void handleShareClick(fmt.id, fmt.label);
                          // No need to close drawer here as dialog will open
                        }}
                      >
                        {fmt.label}
                      </Button>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </DrawerContent>
        </Drawer>
      )}
    </>
  );
}
