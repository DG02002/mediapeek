import { PolicyLayout, PolicySection } from "~/components/policy-layout"

import type { Route } from "./+types/route"

export const meta: Route.MetaFunction = () => [
  { title: "Open-source Licenses - MediaPeek" },
  {
    name: "description",
    content:
      "The MediaPeek project license and selected third-party attributions.",
  },
]

export default function OpenSourceLicenses() {
  return (
    <PolicyLayout
      title="Open-source licenses"
      description="The MediaPeek source code and selected third-party attributions."
      showReviewStatus={false}
    >
      <PolicySection title="MediaPeek">
        <p>
          MediaPeek is released under the GNU General Public License, version
          3.0. Read the{" "}
          <a
            href="https://github.com/DG02002/mediapeek/blob/main/LICENSE"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4"
          >
            full project license
          </a>
          .
        </p>
      </PolicySection>

      <PolicySection title="Third-party acknowledgments">
        <p>
          MediaPeek uses the MediaInfo engine through{" "}
          <a
            href="https://github.com/buzz/mediainfo.js"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4"
          >
            mediainfo.js
          </a>
          , a WebAssembly port of MediaInfoLib. See{" "}
          <a
            href="https://mediaarea.net/en/MediaInfo/License"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4"
          >
            MediaInfo&apos;s license information
          </a>
          .
        </p>
        <p>
          The repository&apos;s{" "}
          <a
            href="https://github.com/DG02002/mediapeek/blob/main/README.md#acknowledgments"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4"
          >
            acknowledgments
          </a>{" "}
          describe other named services and assets. This page is not a complete
          inventory of every third-party package; package-level license files
          and notices remain applicable.
        </p>
      </PolicySection>
    </PolicyLayout>
  )
}
