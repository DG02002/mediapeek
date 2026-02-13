import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@mediapeek/ui/components/accordion';
import { memo } from 'react';

import {
  getString,
  isArray,
  isPrimitive,
  isRecord,
  partitionEntries,
  safeString,
} from '~/lib/type-guards';

// Map specific technical keys to user-friendly labels (based on MediaInfo text output)
const LABEL_MAP: Record<string, string> = {
  // AC-4 / MPEG-H Common
  PresentationID: 'Presentation ID',
  ChannelMode: 'Channel mode',
  DolbyAtmos: 'Dolby Atmos',
  DialogueNormalization: 'Dialogue normalization',
  IntegratedLoudness_Speech: 'Integrated loudness (speech gated)',
  IntegratedLoudness_Level: 'Integrated loudness (level gated)',
  RealtimeLoudnessCorrected: 'Realtime loudness corrected',
  Eac3DrcProfile: 'E-AC-3 DRC profile',
  HomeTheaterAvr: 'Home theater AVR',
  FlatPanelTv: 'Flat panel TV',
  PortableSpeakers: 'Portable speakers',
  PortableHeadphones: 'Portable headphones',
  LoRoCenterMixGain: 'LoRo center mix gain',
  LoRoSurroundMixGain: 'LoRo surround mix gain',
  LtRtCenterMixGain: 'LtRt center mix gain',
  LtRtSurroundMixGain: 'LtRt surround mix gain',
  LfeMixGain: 'LFE mix gain',
  PreferredDownmix: 'Preferred downmix',
  ContentClassifier: 'Content classifier',
  ChannelCoded: 'Channel coded',
  NumberOfSubstreams: 'Number of substreams',
  DialogueEnhancement: 'Dialogue enhancement',
  MaxGain: 'Max gain',
  LinkedTo_Group_Pos: 'Linked to Group Pos',
  // Global / Stream Elements
  SignalGroupCount: 'SignalGroupCount',
  DrcSets_Count: 'DRC set count',
  DrcSets_Effects: 'DRC effect type(s)',
  Loudness_Count: 'Loudness info count',
  SamplePeakLevel: 'Sample peak level',
  Loudness_Anchor: 'Anchor loudness',
  Loudness_Program: 'Program loudness',
  Channels: 'Channel(s)',
  Channels_String: 'Channel(s)',
  NumberOfObjects: 'Number of objects',
  NumberOfObjects_String: 'Number of objects',
  BedChannelConfiguration: 'Bed Layout',
  CodecConfigurationBox: 'Codec Configuration Box',
  // Generic / Others
  bitstream_version: 'Bitstream version',
  PresentationLevel: 'Presentation level',
  AudioLoudnessStandard: 'Audio Loudness Standard',
  DialogueCorrected: 'Dialogue corrected',
};

// Helper to clean keys
function formatLabel(key: string) {
  // 1. Check direct map
  if (LABEL_MAP[key]) return LABEL_MAP[key];

  // 2. Generic formatting
  return key
    .replace(/_/g, ' ') // Replace underscores with spaces
    .replace(/([A-Z]+)/g, ' $1') // Space before upper case sequences
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2') // Handling TitleCase vs acronyms
    .trim()
    .replace(/^./, (str) => str.toUpperCase()); // Cap first letter
}

/**
 * Get display text for an array item (for accordion headers)
 */
function getItemDisplayText(item: unknown): string | null {
  const classifier = getString(item, 'Classifier');
  if (classifier) return classifier;

  const type = getString(item, 'Type');
  if (type) return type;

  const langString = getString(item, 'Language_String');
  if (langString) return langString;

  return null;
}

/**
 * Get header subtitle text for object display
 */
function getHeaderSubtitle(data: unknown): string | null {
  const langString = getString(data, 'Language_String');
  if (langString) return langString;

  const formatProfile = getString(data, 'Format_Profile');
  if (formatProfile) return formatProfile;

  const channelMode = getString(data, 'ChannelMode');
  if (channelMode) return channelMode;

  return null;
}

/**
 * Check if a key should be hidden from display
 */
function shouldHideKey(key: string, val: unknown): boolean {
  return (
    key === 'Pos' ||
    key === 'Index' ||
    key.endsWith('_String') ||
    key === 'Language_String' ||
    key === 'Language' ||
    key === 'Type' ||
    key === 'Classifier' ||
    (key.startsWith('LinkedTo_') && safeString(val) === '0')
  );
}

interface StructureBlockProps {
  data: unknown;
  label?: string;
  depth?: number;
}

const StructureBlockImpl = function StructureBlock({
  data,
  label,
  depth = 0,
}: StructureBlockProps) {
  if (!data) return null;

  // Array of objects (e.g., SignalGroup list, Presentation list)
  if (isArray(data)) {
    // Case 1: Multiple Items -> Use Accordion
    if (data.length > 1) {
      return (
        <div className="flex w-full max-w-full flex-col gap-3">
          {label && (
            <div className="mb-1">
              <span className="text-muted-foreground/80 text-sm font-bold tracking-widest uppercase">
                {label} ({String(data.length)})
              </span>
            </div>
          )}
          <Accordion
            defaultValue={data.map((_, i) => String(i))}
            className="w-full"
          >
            {data.map((item, idx) => {
              const displayText = getItemDisplayText(item);
              return (
                <AccordionItem key={String(idx)} value={String(idx)}>
                  <AccordionTrigger className="py-3 text-xs tracking-wider uppercase hover:no-underline">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">#{String(idx + 1)}</span>
                      {displayText && (
                        <span className="truncate font-semibold normal-case">
                          {displayText}
                        </span>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="pt-2 pl-1">
                      <StructureBlock data={item} depth={depth + 1} />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </div>
      );
    }

    // Case 2: Single Item -> Render directly (Smart Flattening)
    if (data.length === 1) {
      return <StructureBlock data={data[0]} label={label} depth={depth} />;
    }

    return null;
  }

  // Single Object
  if (isRecord(data)) {
    const { primitives, complex } = partitionEntries(data);
    const headerSubtitle = getHeaderSubtitle(data);

    return (
      <div className="flex flex-col gap-4">
        {/* Header - Styled clearly but simply */}
        {label && (
          <div className="border-border/40 mb-1 flex flex-wrap items-baseline gap-2 border-b pb-1">
            <span className="text-muted-foreground/80 text-sm font-bold tracking-widest uppercase">
              {label}
            </span>
            {headerSubtitle && label !== 'Extra' && (
              <span className="text-foreground/80 text-xs font-medium">
                {headerSubtitle}
              </span>
            )}
          </div>
        )}

        {/* Grid for primitives - EXACT STYLE MATCH TO AUDIO TRACK ROW */}
        {primitives.length > 0 && (
          <div className="grid grid-cols-1 gap-x-3 gap-y-3 sm:grid-cols-2 md:grid-cols-4 md:gap-4">
            {primitives.map(([key, val]) => {
              if (shouldHideKey(key, val)) return null;

              return (
                <div key={key} className="flex min-w-0 flex-col">
                  {/* LABEL: Exact match to AudioTrackRow */}
                  <span className="text-muted-foreground/70 truncate text-[10px] tracking-wider uppercase">
                    {formatLabel(key)}
                  </span>
                  {/* VALUE: Exact match to AudioTrackRow */}
                  <span className="text-foreground/85 text-sm leading-tight font-medium break-all">
                    {isPrimitive(val) ? String(val) : safeString(val)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Recursive render for nested complex objects */}
        {complex.length > 0 && (
          <div className="mt-2 flex flex-col gap-6">
            {/* Logic change: Use Accordion for multiple complex items instead of horizontal tabs */}
            {complex.length > 1 ? (
              <Accordion
                defaultValue={complex.map(([key]) => key)}
                className="w-full"
              >
                {complex.map(([key, val]) => (
                  <AccordionItem key={key} value={key}>
                    <AccordionTrigger className="py-3 text-xs tracking-wider uppercase hover:no-underline">
                      <span className="font-semibold">{formatLabel(key)}</span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="pt-2 pl-1">
                        <StructureBlock
                          data={val}
                          // Don't pass label here as the accordion item is the label
                          depth={depth + 1}
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            ) : (
              // Single complex item -> Render directly list or generic block
              complex.map(([key, val]) => (
                <StructureBlock
                  key={key}
                  data={val}
                  label={formatLabel(key)}
                  depth={depth + 1}
                />
              ))
            )}
          </div>
        )}
      </div>
    );
  }

  return null;
};

export const StructureBlock = memo(StructureBlockImpl);
