import { Link } from "react-router"

import { PolicyLayout, PolicySection } from "~/components/policy-layout"

import type { Route } from "./+types/route"

export const meta: Route.MetaFunction = () => [
  { title: "Terms of Use - MediaPeek" },
  {
    name: "description",
    content: "Terms for using the MediaPeek web app and analysis service.",
  },
]

export default function TermsOfUse() {
  return (
    <PolicyLayout
      title="Terms of Use"
      description="These terms describe the MediaPeek browser app and the rules for using its public media analysis service."
    >
      <PolicySection title="Using MediaPeek">
        <p>
          By accessing or using the MediaPeek web app, you agree to these terms
          and the related{" "}
          <Link to="/privacy" className="underline underline-offset-4">
            Privacy Policy
          </Link>
          . If you do not agree, do not use the service.
        </p>
        <p>
          MediaPeek analyzes media from a URL you submit and displays technical
          metadata. It has no accounts or sign-in. Analysis requests are subject
          to the service&apos;s request limits and security checks.
        </p>
      </PolicySection>

      <PolicySection title="URLs and reports">
        <p>
          Submit only URLs you are authorized to access and analyze. Do not use
          MediaPeek to access private resources, bypass a source host&apos;s
          controls, interfere with the service, evade rate limits, or probe its
          security.
        </p>
        <p>
          MediaPeek requests media bytes from the source host to produce a
          report. The source host may refuse the request or provide incomplete
          data, and analysis results may be incomplete or incorrect. Review
          results before relying on them.
        </p>
        <p>
          Submitting a URL does not transfer ownership of the media or its
          metadata. You are responsible for the URLs you submit and for deciding
          whether a report may be exported or shared.
        </p>
      </PolicySection>

      <PolicySection title="Exports and sharing">
        <p>
          Saved Media Reports stay in your browser until you delete them or
          clear the site&apos;s browser data. Exporting downloads a report to
          your device. Sharing uploads the selected output in encrypted form to
          PrivateBin and creates a link containing the key in its URL fragment.
          Anyone with the complete link can read that report. Share only
          information you are allowed to share.
        </p>
      </PolicySection>

      <PolicySection title="Third-party services">
        <p>
          MediaPeek runs on Cloudflare Workers. Media requests go from the
          analyzer to the media source host. If you choose to share a report,
          the encrypted paste is hosted by PrivateBin. Those services are
          operated separately and may have their own terms and privacy
          practices.
        </p>
        <p>
          The MediaPeek source code is available under the GNU General Public
          License, version 3.0. See the{" "}
          <a
            href="https://github.com/DG02002/mediapeek/blob/main/LICENSE"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4"
          >
            project license
          </a>{" "}
          for its terms. These Terms of Use do not replace that license.
        </p>
      </PolicySection>

      <PolicySection title="Availability and warranty">
        <p>
          MediaPeek may not be available at all times, and analysis may fail for
          reasons such as an unsupported format, an unavailable source, or
          service limits. The service is provided “as is” and “as available.” To
          the extent permitted by law, MediaPeek disclaims implied warranties
          including merchantability, fitness for a particular purpose, and
          non-infringement. MediaPeek does not promise uninterrupted, secure, or
          error-free operation.
        </p>
      </PolicySection>

      <PolicySection title="Liability">
        <p>
          To the maximum extent permitted by law, MediaPeek is not liable for
          indirect, incidental, special, consequential, or punitive damages, or
          loss of profits or revenue, arising from use of the service or media
          analyzed through it.
        </p>
      </PolicySection>

      <PolicySection title="Indemnity">
        <p>
          You agree to indemnify and hold MediaPeek and its contributors
          harmless from third-party claims, losses, liabilities, and expenses
          arising from your use of the service.
        </p>
      </PolicySection>

      <PolicySection title="Feedback">
        <p>
          MediaPeek does not provide an in-app feedback form. GitHub issues are
          public. The terms for any rights or permissions needed to use feedback
          submitted there need product and legal review before publication.
        </p>
      </PolicySection>

      <PolicySection title="Questions and updates">
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
          The date at the top of this page identifies this draft&apos;s update
          date.
        </p>
      </PolicySection>
    </PolicyLayout>
  )
}
