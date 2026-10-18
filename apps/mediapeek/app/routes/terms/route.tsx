import { Link } from "react-router"

import { PolicyLayout, PolicySection } from "~/components/policy-layout"

import type { Route } from "./+types/route"

export const meta: Route.MetaFunction = () => [
  { title: "Terms of Use - MediaPeek" },
  {
    name: "description",
    content:
      "Draft terms describing the MediaPeek web app and analysis service.",
  },
]

export default function TermsOfUse() {
  return (
    <PolicyLayout
      title="Terms of Use"
      description="This draft describes the MediaPeek web app, its public analysis service, and expected use."
    >
      <PolicySection title="About this draft">
        <p>
          MediaPeek analyzes technical metadata from a public media URL you
          submit. The repository does not identify the service&apos;s legal
          operator or contracting entity, or establish when visitors accept
          these terms. Confirm those details before using this page as an
          agreement.
        </p>
      </PolicySection>

      <PolicySection title="Service and availability">
        <p>
          The web app validates a submitted URL and asks the analyzer Worker to
          inspect the remote media. The analyzer reads byte ranges where the
          source supports them and returns the metadata produced by MediaInfo.
          Source hosts can refuse requests, and unsupported formats or service
          limits can prevent an analysis from completing.
        </p>
        <p>
          Analysis results can be incomplete or incorrect. Review a report
          before relying on it.
        </p>
      </PolicySection>

      <PolicySection title="Your responsibilities">
        <p>
          Submit only URLs you are authorized to access and analyze. Do not use
          MediaPeek to bypass authentication or a source host&apos;s access
          controls, request private or internal network resources, interfere
          with the service, evade its request limits, or probe its security.
        </p>
        <p>
          You are responsible for the URLs you submit and for deciding whether
          to export or share the resulting report. Submitting a URL does not
          transfer ownership of the media or its metadata.
        </p>
      </PolicySection>

      <PolicySection title="Reports and third-party services">
        <p>
          Saved Media Reports remain in your browser until you delete them or
          clear the site&apos;s browser data. Exporting downloads the selected
          report to your device. If you choose to share a report, MediaPeek
          encrypts the selected output in your browser and uploads it to
          PrivateBin. The link contains the decryption key in its URL fragment;
          anyone with the complete link can read the report.
        </p>
        <p>
          MediaPeek runs on Cloudflare Workers. Media requests go from the
          analyzer to the media source host. Cloudflare and PrivateBin operate
          separate services and may process requests under their own terms and
          privacy practices.
        </p>
      </PolicySection>

      <PolicySection title="Project license">
        <p>
          The MediaPeek source code is available under the GNU General Public
          License, version 3.0. Read the{" "}
          <a
            href="https://github.com/DG02002/mediapeek/blob/main/LICENSE"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4"
          >
            project license
          </a>
          . These draft terms do not replace that license.
        </p>
      </PolicySection>

      <PolicySection title="Questions and related policies">
        <p>
          For questions or corrections, use the{" "}
          <a
            href="https://github.com/DG02002/mediapeek/issues"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4"
          >
            MediaPeek GitHub issues page
          </a>
          . Issues are public; do not include personal, private, or confidential
          information.
        </p>
        <p>
          Read the{" "}
          <Link to="/privacy" className="underline underline-offset-4">
            Privacy Policy
          </Link>
          ,{" "}
          <Link to="/cookies" className="underline underline-offset-4">
            Cookie Policy
          </Link>
          , and{" "}
          <Link to="/usage" className="underline underline-offset-4">
            Usage Policy
          </Link>
          .
        </p>
      </PolicySection>

      <PolicySection title="Terms requiring approval before publication">
        <p>
          The repository does not establish the legal operator and address,
          method of acceptance, governing law or dispute venue, effective date,
          warranty or liability terms, indemnity obligations, or rights to use
          feedback. Product and qualified legal reviewers must supply and
          approve those terms before publication.
        </p>
      </PolicySection>
    </PolicyLayout>
  )
}
