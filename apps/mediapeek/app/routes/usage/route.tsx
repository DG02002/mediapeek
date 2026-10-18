import { createFileRoute, Link } from "@tanstack/react-router"

import { PolicyLayout, PolicySection } from "~/components/policy-layout"

function UsagePolicy() {
  return (
    <PolicyLayout
      title="Usage Policy"
      description="This draft covers the public media analysis service and the responsibilities that come with submitting URLs."
    >
      <PolicySection title="Purpose and scope">
        <p>
          MediaPeek analyzes technical metadata from media URLs you submit. This
          Usage Policy applies to the public analysis service and should be read
          with the{" "}
          <Link to="/terms" className="underline underline-offset-4">
            Terms of Use
          </Link>{" "}
          and{" "}
          <Link to="/privacy" className="underline underline-offset-4">
            Privacy Policy
          </Link>
          .
        </p>
        <p>
          MediaPeek has no accounts or sign-in. You are responsible for the URLs
          you submit and for deciding whether to export or share the resulting
          report.
        </p>
      </PolicySection>

      <PolicySection title="Use URLs you are authorized to access">
        <p>
          Submit only URLs you are authorized to access and analyze. Do not use
          MediaPeek to bypass authentication or a source host&apos;s access
          controls, or to request private or internal network resources.
        </p>
        <p>
          MediaPeek applies outbound target checks and blocks local and private
          network destinations. The source host can refuse requests or return
          incomplete data. See the{" "}
          <Link to="/privacy" className="underline underline-offset-4">
            Privacy Policy
          </Link>{" "}
          for information about the requests made to the source host.
        </p>
      </PolicySection>

      <PolicySection title="Protect the service">
        <p>
          Do not interfere with MediaPeek, evade its request limits, or probe
          its security. The analyze endpoint applies admission control and may
          reject requests that exceed its configured limit. Turnstile is a
          separate feature that is disabled by default.
        </p>
        <p>
          Do not use MediaPeek to access systems or data without authorization,
          disrupt a source host, or violate the rights of other people. The
          examples in this section are illustrative and do not change the
          service limits described in the{" "}
          <Link to="/terms" className="underline underline-offset-4">
            Terms of Use
          </Link>
          .
        </p>
      </PolicySection>

      <PolicySection title="Reports and sharing">
        <p>
          Saved Media Reports stay in your browser until you delete them or
          clear the site&apos;s browser data. If you create a share link, the
          selected output is encrypted in your browser and uploaded to
          PrivateBin. Anyone with the complete link can read the report. Share
          only reports you are authorized to disclose.
        </p>
      </PolicySection>

      <PolicySection title="Reporting and policy status">
        <p>
          For service questions, use the{" "}
          <a
            href="https://github.com/DG02002/mediapeek/issues"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4"
          >
            MediaPeek GitHub issues page
          </a>
          . Issues are public; do not include private URLs, credentials, or
          personal information. Report suspected security vulnerabilities using
          the{" "}
          <a
            href="https://github.com/DG02002/mediapeek/security/advisories/new"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4"
          >
            private vulnerability reporting form
          </a>
          .
        </p>
        <p>
          MediaPeek does not provide an account-based appeal flow. This draft
          does not describe additional monitoring, suspension, or enforcement
          processes. Product and legal review is required before publication.
        </p>
      </PolicySection>

      <PolicySection title="Related policies">
        <p>
          Read the{" "}
          <Link to="/terms" className="underline underline-offset-4">
            Terms of Use
          </Link>
          ,{" "}
          <Link to="/privacy" className="underline underline-offset-4">
            Privacy Policy
          </Link>
          , and{" "}
          <Link to="/cookies" className="underline underline-offset-4">
            Cookie Policy
          </Link>
          . All require product and legal review before publication.
        </p>
      </PolicySection>

      <PolicySection title="Review before publication">
        <p>
          Confirm the service operator and private contact for service or
          security reports. Add enforcement actions or a review process only if
          the product owner and legal reviewer approve them.
        </p>
      </PolicySection>
    </PolicyLayout>
  )
}

export const Route = createFileRoute("/usage")({
  head: () => ({
    meta: [
      { title: "Usage Policy - MediaPeek" },
      {
        name: "description",
        content: "Rules for submitting media URLs to MediaPeek.",
      },
    ],
  }),
  component: UsagePolicy,
})
