import { Link } from "react-router"

import { PolicyLayout, PolicySection } from "~/components/policy-layout"

import type { Route } from "./+types/route"

export const meta: Route.MetaFunction = () => [
  { title: "Privacy Policy - MediaPeek" },
  {
    name: "description",
    content: "How the MediaPeek web app handles URLs, reports, and sharing.",
  },
]

export default function PrivacyPolicy() {
  return (
    <PolicyLayout
      title="Privacy Policy"
      description="This draft describes the information processed when you analyze a media URL, keep a report in your browser, export it, or choose to share it."
    >
      <PolicySection title="How MediaPeek works">
        <p>
          MediaPeek has no accounts or sign-in. When you submit a URL, your
          browser sends it to MediaPeek&apos;s analyze endpoint. The web Worker
          validates the request and passes it to the analyzer Worker, which
          requests media bytes from the source URL and returns the analysis.
        </p>
        <p>
          The analyzer uses byte-range requests where the source supports them.
          The source host receives those requests from MediaPeek&apos;s
          infrastructure and may process them under its own privacy terms. A URL
          can contain private or identifying information, so submit only URLs
          you intend to send to the service and their source host.
        </p>
      </PolicySection>

      <PolicySection title="Reports stay in your browser">
        <p>
          Analysis results remain in the browser unless you choose to export or
          share them. When you save a Media Report, MediaPeek stores its
          requested output formats in IndexedDB on your device. The report
          remains there until you delete it or clear this site&apos;s browser
          data. MediaPeek does not keep a server-side report library.
        </p>
        <p>
          Exporting downloads a file to your device. Importing a report library
          reads the file you choose and adds its reports to this browser&apos;s
          library.
        </p>
      </PolicySection>

      <PolicySection title="Clipboard and browser storage">
        <p>
          When your browser allows clipboard access, MediaPeek can check for a
          URL when you focus the media URL field. The clipboard value stays in
          your browser unless you submit it for analysis. You can also paste a
          URL directly into the field.
        </p>
        <p>
          MediaPeek uses a session cookie named <code>theme</code> to remember
          the display theme. Turnstile verification is disabled by default. If
          enabled, MediaPeek sets an <code>mp_turnstile_grant</code> cookie for
          the analyze route and URL being analyzed; it expires within 10
          minutes. The browser loads Cloudflare Turnstile and MediaPeek sends
          the response token to Cloudflare for server-side verification. See
          Cloudflare&apos;s{" "}
          <a
            href="https://www.cloudflare.com/en-au/turnstile-privacy-policy/"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4"
          >
            Turnstile Privacy Addendum
          </a>
          .
        </p>
      </PolicySection>

      <PolicySection title="Sharing a report">
        <p>
          Sharing is optional. When you choose Share, MediaPeek encrypts the
          selected report output in your browser and uploads the encrypted
          payload to PrivateBin. The generated link contains the decryption key
          in its URL fragment. Anyone with the full link can open the report, so
          share it only with people you trust. The upload is configured to
          expire after one week; PrivateBin controls the hosted paste and its
          availability.
        </p>
        <p>
          Read the{" "}
          <a
            href="https://privatebin.info/"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4"
          >
            PrivateBin project information
          </a>{" "}
          for how that service handles requests and encrypted pastes.
        </p>
      </PolicySection>

      <PolicySection title="Service diagnostics">
        <p>
          MediaPeek&apos;s analyze endpoint can record request IDs, request
          paths, response status, timing, IP address, and browser user-agent for
          service operations. Analysis diagnostics can include the submitted
          source URL with selected sensitive query values redacted. The logger
          can sample routine entries; warnings, errors, and slow requests bypass
          that sampling. The repository does not specify how long infrastructure
          or diagnostic logs are retained.
        </p>
        <p>
          MediaPeek runs on Cloudflare Workers. Cloudflare processes traffic to
          deliver the service and may handle information under its own terms.
          See the{" "}
          <a
            href="https://www.cloudflare.com/privacypolicy/"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4"
          >
            Cloudflare Privacy Policy
          </a>
          . The repository does not establish a retention period for
          infrastructure or diagnostic logs.
        </p>
      </PolicySection>

      <PolicySection title="Your choices and questions">
        <p>
          You can delete saved reports in MediaPeek or clear this site&apos;s
          browser data, including its cookies. You control whether to export a
          report or create a PrivateBin share link.
        </p>
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
      </PolicySection>

      <PolicySection title="Related terms">
        <p>
          The service terms are on the{" "}
          <Link to="/terms" className="underline underline-offset-4">
            Terms of Use
          </Link>{" "}
          page. Both policy drafts need product and legal review before
          publication.
        </p>
      </PolicySection>
    </PolicyLayout>
  )
}
