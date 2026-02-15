import {
  Copy01Icon,
  File01Icon,
  MoreVerticalIcon,
  QuoteDownIcon,
  Share01Icon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@mediapeek/ui/components/alert-dialog';
import { Button, buttonVariants } from '@mediapeek/ui/components/button';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@mediapeek/ui/components/drawer';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@mediapeek/ui/components/dropdown-menu';
import { Input } from '@mediapeek/ui/components/input';
import { Label } from '@mediapeek/ui/components/label';
import { Separator } from '@mediapeek/ui/components/separator';
import { Switch } from '@mediapeek/ui/components/switch';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@mediapeek/ui/components/tabs';
import { cn } from '@mediapeek/ui/lib/utils';
import * as React from 'react';
import { useId } from 'react';
import { toast } from 'sonner';

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

  const viewTextId = useId();
  const showTitlesId = useId();

  const [shareDialogOpen, setShareDialogOpen] = React.useState(false);
  const [shareData, setShareData] = React.useState<{
    url: string;
    label: string;
  } | null>(null);

  const shareClickedRef = React.useRef(false);

  const blurActiveElement = () => {
    if (typeof document === 'undefined') return;
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement) {
      activeElement.blur();
    }
  };

  const handleShareClick = async (format: string, label: string) => {
    try {
      const shareUrl = await getShareUrl(format, label);
      if (shareUrl) {
        shareClickedRef.current = true;
        setShareData({ url: shareUrl, label });
        setOpen(false); // Close the main menu first

        // Wait for drawer close animation to finish before opening dialog
        // This prevents layout thrashing and jitter on mobile
        setTimeout(() => {
          blurActiveElement();
          setShareDialogOpen(true);
          shareClickedRef.current = false;
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
      setShareDialogOpen(false);
    }
  };

  return (
    <>
      <AlertDialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Link Created</AlertDialogTitle>
            <AlertDialogDescription>
              The <strong>{shareData?.label}</strong> metadata for this file has
              been encrypted:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-4">
            <div className="min-w-0 text-sm">
              <span className="text-foreground line-clamp-3 font-medium break-all">
                {filename}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="grid flex-1 gap-2">
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
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={copyToClipboard}>
              Copy Link
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                window.open(shareData?.url, '_blank', 'noreferrer');
                setShareDialogOpen(false);
              }}
            >
              Open
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isDesktop ? (
        <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
          <DropdownMenuTrigger
            className={cn(
              buttonVariants({ variant: 'ghost', size: 'icon' }),
              className,
            )}
          >
            <HugeiconsIcon icon={MoreVerticalIcon} size={20} />
            <span className="sr-only">Options</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem
              onClick={(e) => {
                e.preventDefault();
                setIsTextView(!isTextView);
              }}
            >
              <div className="flex flex-1 items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  {isTextView ? (
                    <HugeiconsIcon icon={File01Icon} size={16} />
                  ) : (
                    <HugeiconsIcon
                      icon={File01Icon}
                      size={16}
                      className="opacity-50"
                    />
                  )}
                  View as Text
                </span>
                {/* Use pointer-events-none to let the parent DropdownMenuItem handle the click/toggle */}
                <Switch
                  checked={isTextView}
                  className="pointer-events-none"
                  aria-readonly
                />
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.preventDefault();
                setShowOriginalTitles(!showOriginalTitles);
              }}
            >
              <div className="flex flex-1 items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  {showOriginalTitles ? (
                    <HugeiconsIcon icon={QuoteDownIcon} size={16} />
                  ) : (
                    <HugeiconsIcon
                      icon={QuoteDownIcon}
                      size={16}
                      className="opacity-50"
                    />
                  )}
                  Show Original Titles
                </span>
                <Switch
                  checked={showOriginalTitles}
                  className="pointer-events-none"
                  aria-readonly
                />
              </div>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <HugeiconsIcon icon={Copy01Icon} size={16} className="mr-2" />
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
                <HugeiconsIcon icon={Share01Icon} size={16} className="mr-2" />
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
          <DrawerTrigger
            className={cn(
              buttonVariants({ variant: 'ghost', size: 'icon' }),
              className,
            )}
          >
            <HugeiconsIcon icon={MoreVerticalIcon} size={20} />
            <span className="sr-only">Options</span>
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
                  htmlFor={viewTextId}
                  className="flex flex-1 cursor-pointer items-center gap-2 py-2 font-normal"
                >
                  <HugeiconsIcon icon={File01Icon} size={16} />
                  View as Text
                </Label>
                <Switch
                  id={viewTextId}
                  checked={isTextView}
                  onCheckedChange={setIsTextView}
                />
              </div>
              <div className="flex items-center justify-between space-x-2">
                <Label
                  htmlFor={showTitlesId}
                  className="flex flex-1 cursor-pointer items-center gap-2 py-2 font-normal"
                >
                  <HugeiconsIcon icon={QuoteDownIcon} size={16} />
                  Show Original Titles
                </Label>
                <Switch
                  id={showTitlesId}
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
