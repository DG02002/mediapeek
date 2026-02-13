import { MEDIA_CONSTANTS } from '~/lib/media/constants';

interface TrademarkNoticeProps {
  badges: string[];
}

export function TrademarkNotice({ badges }: TrademarkNoticeProps) {
  const notices: string[] = [];
  const { BADGES } = MEDIA_CONSTANTS;

  // 1. Dolby Trademarks
  const hasDolbyVision = badges.includes(BADGES.DOLBY_VISION);
  const hasDolbyAtmos = badges.includes(BADGES.DOLBY_ATMOS);
  const hasDolbyAudio = badges.includes(BADGES.DOLBY_AUDIO);

  if (hasDolbyVision || hasDolbyAtmos || hasDolbyAudio) {
    const terms = ['Dolby'];
    if (hasDolbyVision) terms.push('Dolby Vision');
    if (hasDolbyAtmos) terms.push('Dolby Atmos');
    if (hasDolbyAudio) terms.push('Dolby Audio');

    // Formatting: "Dolby, Dolby Vision, and Dolby Atmos..."
    const termsString =
      terms.length > 1
        ? `${terms.slice(0, -1).join(', ')} and ${terms[terms.length - 1]}`
        : terms[0];

    notices.push(
      `${termsString} and the double-D symbol are trademarks of Dolby Laboratories Licensing Corporation.`,
    );
  }

  // 2. IMAX
  if (badges.includes(BADGES.IMAX)) {
    notices.push('IMAX® is a registered trademark of IMAX Corporation.');
  }

  // 3. DTS
  const hasDTS = badges.includes(BADGES.DTS);
  const hasDTSX = badges.includes(BADGES.DTS_X);

  if (hasDTS || hasDTSX) {
    // Official text from DTS terms:
    notices.push(
      'DTS, the Symbol, DTS and the Symbol together, DTS:X, and the DTS:X logo are registered trademarks or trademarks of DTS, Inc. in the United States and/or other countries.',
    );
  }

  // 4. HDR10+
  if (badges.includes(BADGES.HDR10_PLUS)) {
    notices.push('HDR10+™ logo is a trademark of HDR10+ Technologies, LLC.');
  }

  // 5. AV1
  if (badges.includes(BADGES.AV1)) {
    notices.push('AV1 is a trademark of the Alliance for Open Media.');
  }

  if (notices.length === 0) return null;

  return (
    <div className="border-border/40 mt-8 space-y-2 border-t pt-6">
      {notices.map((notice, idx) => (
        <p
          key={idx}
          className="text-muted-foreground/60 text-[10px] leading-relaxed"
        >
          {notice}
        </p>
      ))}
    </div>
  );
}
