import {
  Copy01Icon,
  File01Icon,
  MoreVerticalIcon,
  QuoteDownIcon,
  Share01Icon,
} from "@hugeicons/core-free-icons"
import * as React from "react"
import { useId } from "react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog"
import { Button, buttonVariants } from "~/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "~/components/ui/drawer"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { Icon } from "~/components/ui/icon"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Separator } from "~/components/ui/separator"
import { Switch } from "~/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs"
import { useMediaActions } from "~/hooks/use-media-actions"
import { useMediaQuery } from "~/hooks/use-media-query"
import { cn } from "~/lib/utils"

import type { MediaPngExportTheme } from "./media-export"

interface OptionsMenuProps {
  data: Record<string, string>
  url: string
  filename: string
  requestTurnstileToken?: () => Promise<string | null>
  isTextView: boolean
  setIsTextView: (val: boolean) => void
  showOriginalTitles: boolean
  setShowOriginalTitles: (val: boolean) => void
  className?: string
  onShareSuccess?: (url: string) => void
  onExportPng: (theme: MediaPngExportTheme) => Promise<void>
  isExportingPng: boolean
}

const formats = [
  { id: "json", label: "Object" },
  { id: "json", label: "JSON" },
  { id: "text", label: "Text" },
  { id: "xml", label: "XML" },
  { id: "html", label: "HTML" },
]

const blurActiveElement = () => {
  const { activeElement } = document

  if (activeElement instanceof HTMLElement) {
    activeElement.blur()
  }
}

export function OptionsMenu({
  data,
  url,
  filename,
  requestTurnstileToken,
  isTextView,
  setIsTextView,
  showOriginalTitles,
  setShowOriginalTitles,
  className,
  onShareSuccess,
  onExportPng,
  isExportingPng,
}: OptionsMenuProps) {
  const { handleCopy, getShareUrl } = useMediaActions({
    data,
    url,
    requestTurnstileToken,
  })

  const isDesktop = useMediaQuery("(min-width: 768px)")
  const [open, setOpen] = React.useState(false)

  const viewTextId = useId()
  const showTitlesId = useId()

  const [shareDialogOpen, setShareDialogOpen] = React.useState(false)

  const [shareData, setShareData] = React.useState<{
    url: string
    label: string
  } | null>(null)

  const shareClickedRef = React.useRef(false)

  const handleShareClick = async (format: string, label: string) => {
    try {
      const shareUrl = await getShareUrl(format, label)

      if (shareUrl) {
        shareClickedRef.current = true
        setShareData({ url: shareUrl, label })
        setOpen(false) // Close the main menu first

        // Wait for drawer close animation to finish before opening dialog
        // This prevents layout thrashing and jitter on mobile
        setTimeout(() => {
          blurActiveElement()
          setShareDialogOpen(true)
          shareClickedRef.current = false
          onShareSuccess?.(shareUrl)
        }, 300)
      }
    } catch {
      // Error is handled in getShareUrl (toast)
    }
  }

  const handlePngExport = async (theme: MediaPngExportTheme) => {
    try {
      await onExportPng(theme)
      toast.success(`PNG report exported in ${theme} theme.`)
      setOpen(false)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to export PNG report."
      )
    }
  }

  const copyToClipboard = () => {
    if (shareData?.url) {
      void navigator.clipboard.writeText(shareData.url)
      toast.success("Link Copied")
      setShareDialogOpen(false)
    }
  }

  return (
    <>
      <AlertDialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Link Created</AlertDialogTitle>
            <AlertDialogDescription>
              The <strong>{shareData?.label}</strong> metadata for this file was
              encrypted and uploaded to PrivateBin.
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
                window.open(shareData?.url, "_blank", "noreferrer")
                setShareDialogOpen(false)
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
              buttonVariants({ variant: "ghost", size: "icon" }),
              className
            )}
          >
            <Icon icon={MoreVerticalIcon} size={20} />
            <span className="sr-only">Options</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem
              onClick={(e) => {
                e.preventDefault()
                setIsTextView(!isTextView)
              }}
            >
              <div className="flex flex-1 items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <Icon
                    icon={File01Icon}
                    size={16}
                    className={isTextView ? undefined : "opacity-50"}
                  />
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
                e.preventDefault()
                setShowOriginalTitles(!showOriginalTitles)
              }}
            >
              <div className="flex flex-1 items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <Icon
                    icon={QuoteDownIcon}
                    size={16}
                    className={showOriginalTitles ? undefined : "opacity-50"}
                  />
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
                <Icon icon={File01Icon} size={16} className="mr-2" />
                <span>Export as PNG</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-48">
                <DropdownMenuItem
                  disabled={isExportingPng}
                  onClick={() => void handlePngExport("light")}
                >
                  Light theme PNG
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={isExportingPng}
                  onClick={() => void handlePngExport("dark")}
                >
                  Dark theme PNG
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Icon icon={Copy01Icon} size={16} className="mr-2" />
                <span>Copy Metadata</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-48">
                {formats.map((fmt, i) => (
                  <DropdownMenuItem
                    key={`${fmt.id}-${String(i)}`}
                    onClick={() => {
                      handleCopy(fmt.id, fmt.label)
                    }}
                  >
                    Copy {fmt.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Icon icon={Share01Icon} size={16} className="mr-2" />
                <span>Share Metadata</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-48">
                {formats.map((fmt, i) => (
                  <DropdownMenuItem
                    key={`${fmt.id}-${String(i)}`}
                    onClick={() => {
                      void handleShareClick(fmt.id, fmt.label)
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
              buttonVariants({ variant: "ghost", size: "icon" }),
              className
            )}
          >
            <Icon icon={MoreVerticalIcon} size={20} />
            <span className="sr-only">Options</span>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader className="text-left">
              <DrawerTitle>Options</DrawerTitle>
              <DrawerDescription>
                Configure, export, copy, or share this report.
              </DrawerDescription>
            </DrawerHeader>
            <div className="grid gap-4 px-4 pb-8">
              <div className="flex items-center justify-between space-x-2">
                <Label
                  htmlFor={viewTextId}
                  className="flex flex-1 cursor-pointer items-center gap-2 py-2 font-normal"
                >
                  <Icon icon={File01Icon} size={16} />
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
                  <Icon icon={QuoteDownIcon} size={16} />
                  Show Original Titles
                </Label>
                <Switch
                  id={showTitlesId}
                  checked={showOriginalTitles}
                  onCheckedChange={setShowOriginalTitles}
                />
              </div>

              <Separator className="my-2" />

              <div className="grid gap-2">
                <p className="text-muted-foreground text-xs font-medium">
                  Export report as PNG
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isExportingPng}
                    onClick={() => void handlePngExport("light")}
                  >
                    Light theme
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isExportingPng}
                    onClick={() => void handlePngExport("dark")}
                  >
                    Dark theme
                  </Button>
                </div>
              </div>

              <Tabs defaultValue="copy" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="copy">Copy</TabsTrigger>
                  <TabsTrigger value="share">Share</TabsTrigger>
                </TabsList>
                <TabsContent value="copy" className="mt-4">
                  <p className="text-muted-foreground mb-3 text-xs">
                    Select a format to copy metadata to the clipboard.
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {formats.map((fmt, i) => (
                      <Button
                        key={`copy-${fmt.id}-${String(i)}`}
                        variant="ghost"
                        size="sm"
                        className="bg-muted/30 hover:bg-muted/50 border"
                        onClick={() => {
                          handleCopy(fmt.id, fmt.label)
                          setOpen(false)
                        }}
                      >
                        {fmt.label}
                      </Button>
                    ))}
                  </div>
                </TabsContent>
                <TabsContent value="share" className="mt-4">
                  <p className="text-muted-foreground mb-3 text-xs">
                    Select a format to create an encrypted PrivateBin link.
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {formats.map((fmt, i) => (
                      <Button
                        key={`share-${fmt.id}-${String(i)}`}
                        variant="ghost"
                        size="sm"
                        className="bg-muted/30 hover:bg-muted/50 border"
                        onClick={() => {
                          void handleShareClick(fmt.id, fmt.label)
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
  )
}
