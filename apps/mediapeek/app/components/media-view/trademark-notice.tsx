import { MEDIA_CONSTANTS } from "~/lib/media/constants"

interface TrademarkNoticeProps {
  badges: string[]
}

const getDolbyNotice = (
  badges: string[],
  badgeNames: typeof MEDIA_CONSTANTS.BADGES
) => {
  const terms = ["Dolby"]

  if (badges.includes(badgeNames.DOLBY_VISION)) {
    terms.push("Dolby Vision")
  }

  if (badges.includes(badgeNames.DOLBY_ATMOS)) {
    terms.push("Dolby Atmos")
  }

  if (badges.includes(badgeNames.DOLBY_AUDIO)) {
    terms.push("Dolby Audio")
  }

  if (terms.length === 1) {
    return undefined
  }

  const finalTerm = terms[terms.length - 1]
  const precedingTerms = terms.slice(0, -1).join(", ")
  const termsString = precedingTerms + " and " + finalTerm

  return (
    termsString +
    " and the double-D symbol are trademarks of Dolby Laboratories Licensing Corporation."
  )
}

const getDtsNotice = (
  badges: string[],
  badgeNames: typeof MEDIA_CONSTANTS.BADGES
) => {
  const hasDts = badges.includes(badgeNames.DTS)
  const hasDtsX = badges.includes(badgeNames.DTS_X)

  if (!hasDts && !hasDtsX) {
    return undefined
  }

  return "DTS, the Symbol, DTS and the Symbol together, DTS:X, and the DTS:X logo are registered trademarks or trademarks of DTS, Inc. in the United States and/or other countries."
}

const getTrademarkNotices = (badges: string[]) => {
  const { BADGES } = MEDIA_CONSTANTS
  const notices = [getDolbyNotice(badges, BADGES)]

  if (badges.includes(BADGES.IMAX)) {
    notices.push("IMAX® is a registered trademark of IMAX Corporation.")
  }

  const dtsNotice = getDtsNotice(badges, BADGES)

  if (dtsNotice) {
    notices.push(dtsNotice)
  }

  if (badges.includes(BADGES.HDR10_PLUS)) {
    notices.push("HDR10+™ logo is a trademark of HDR10+ Technologies, LLC.")
  }

  if (badges.includes(BADGES.AV1)) {
    notices.push("AV1 is a trademark of the Alliance for Open Media.")
  }

  return notices.filter((notice): notice is string => notice !== undefined)
}

export function TrademarkNotice({ badges }: TrademarkNoticeProps) {
  const notices = getTrademarkNotices(badges)

  if (notices.length === 0) {
    return null
  }

  return (
    <div>
      {notices.map((notice) => (
        <p
          key={notice}
          className="text-muted-foreground text-xs leading-relaxed [&+&]:mt-3"
        >
          {notice}
        </p>
      ))}
    </div>
  )
}
