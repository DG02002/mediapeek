import { memo } from 'react';

import type { MediaTrackJSON } from '~/types/media';

import { MediaDetailItem } from './media-detail-item';

interface GeneralSectionProps {
  generalTrack?: MediaTrackJSON;
}

export const GeneralSection = memo(function GeneralSection({
  generalTrack,
}: GeneralSectionProps) {
  if (!generalTrack) return null;

  return (
    <section className="space-y-4">
      <div className="text-foreground mb-2 flex items-center gap-2">
        <h2 className="mb-3 text-xl font-semibold tracking-tight">Container</h2>
      </div>
      <div className="border-border grid gap-x-8 gap-y-6 rounded-lg border p-6 text-sm sm:grid-cols-2 md:grid-cols-4">
        {(generalTrack.Format ?? generalTrack.Format_Profile) && (
          <MediaDetailItem label="Format">
            <div className="flex flex-col">
              {(generalTrack.Format_Info ?? generalTrack.Format) && (
                <span className="text-foreground/85 font-semibold break-all">
                  {generalTrack.Format_Info ?? generalTrack.Format}
                </span>
              )}
              {generalTrack.Format_Profile && (
                <span className="text-muted-foreground text-xs font-normal break-all">
                  {generalTrack.Format_Profile}
                </span>
              )}
              {generalTrack.Format_Version && (
                <span className="text-muted-foreground text-xs font-normal break-all">
                  Version {generalTrack.Format_Version}
                </span>
              )}
            </div>
          </MediaDetailItem>
        )}

        {(generalTrack.CodecID ?? generalTrack.CodecID_Compatible) && (
          <MediaDetailItem label="Codec ID">
            <div className="flex flex-col">
              {generalTrack.CodecID && (
                <span className="text-foreground/85 font-semibold break-all">
                  {generalTrack.CodecID}
                </span>
              )}
              {generalTrack.CodecID_Compatible && (
                <span className="text-muted-foreground text-xs font-normal break-all">
                  {generalTrack.CodecID_Compatible}
                </span>
              )}
            </div>
          </MediaDetailItem>
        )}

        {generalTrack.Encoded_Date && (
          <MediaDetailItem
            label="Encoded Date"
            value={generalTrack.Encoded_Date}
          />
        )}

        {generalTrack.Encoded_Application && (
          <MediaDetailItem
            label="Encoded Application"
            value={generalTrack.Encoded_Application}
          />
        )}

        {(generalTrack.UniqueID_String ?? generalTrack.UniqueID) && (
          <MediaDetailItem label="Unique ID" className="col-span-full">
            <span className="text-foreground/85 font-mono font-semibold break-all">
              {generalTrack.UniqueID_String ?? generalTrack.UniqueID}
            </span>
          </MediaDetailItem>
        )}
      </div>
    </section>
  );
});
