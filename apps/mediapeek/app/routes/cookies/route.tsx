import { createFileRoute, Link } from "@tanstack/react-router"

import { PolicyLayout, PolicySection } from "~/components/policy-layout"

function CookiePolicy() {
  return (
    <PolicyLayout
      title="Cookie Policy"
      description="This draft describes cookies set by MediaPeek and the browser storage used by its features."
    >
      <PolicySection title="What this policy covers">
        <p>
          MediaPeek uses cookies to remember your display theme and, when
          enabled, to keep a short-lived Turnstile verification grant. This
          policy describes cookies set by MediaPeek&apos;s application code.
          Cloudflare&apos;s own services are subject to Cloudflare&apos;s
          policies.
        </p>
      </PolicySection>

      <PolicySection title="Cookies set by MediaPeek">
        <p>
          The web app configures the following cookies. The source, purpose,
          duration, and scope below come from its cookie settings.
        </p>
        <div
          aria-label="MediaPeek cookie inventory"
          className="overflow-x-auto"
          role="region"
          tabIndex={0}
        >
          <table className="w-full min-w-[42rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="py-3 pr-4 font-medium" scope="col">
                  Cookie
                </th>
                <th className="py-3 pr-4 font-medium" scope="col">
                  Source
                </th>
                <th className="py-3 pr-4 font-medium" scope="col">
                  Purpose
                </th>
                <th className="py-3 pr-4 font-medium" scope="col">
                  Duration, domain, and scope
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b align-top">
                <th className="py-3 pr-4 font-mono font-normal" scope="row">
                  theme
                </th>
                <td className="py-3 pr-4">MediaPeek web app</td>
                <td className="py-3 pr-4">
                  Stores the selected display theme.
                </td>
                <td className="py-3 pr-4">
                  Browser session (no Expires or Max-Age); current host only (no
                  Domain attribute); path <code>/</code>; HttpOnly;
                  SameSite=Lax.
                </td>
              </tr>
              <tr className="border-b align-top">
                <th className="py-3 pr-4 font-mono font-normal" scope="row">
                  mp_turnstile_grant
                </th>
                <td className="py-3 pr-4">MediaPeek web app</td>
                <td className="py-3 pr-4">
                  Holds a verified Turnstile grant for the analyze route.
                </td>
                <td className="py-3 pr-4">
                  10 minutes; current host only (no Domain attribute); path{" "}
                  <code>/resource/analyze</code>; HttpOnly; SameSite=Lax.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-muted-foreground text-sm">
          The app adds the Secure attribute in production. The theme cookie is
          set when a theme is selected and the theme session is configured. The
          grant cookie is set only when Turnstile is enabled and verification
          succeeds.
        </p>
      </PolicySection>

      <PolicySection title="Turnstile and provider-managed storage">
        <p>
          Turnstile is a separate, optional feature and is disabled by default.
          When it is enabled, the browser loads Cloudflare&apos;s Turnstile
          script and sends its response token to Cloudflare for verification.
          MediaPeek&apos;s code does not identify Cloudflare-managed cookies for
          the production hostname. Cloudflare&apos;s cookie documentation
          describes cookies used by its products, but the repository does not
          identify which edge products are enabled for the deployed hostname.
          Check that configuration before publication. See the{" "}
          <a
            href="https://developers.cloudflare.com/fundamentals/reference/policies-compliances/cloudflare-cookies/"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4"
          >
            Cloudflare cookie documentation
          </a>
          , Cloudflare&apos;s{" "}
          <a
            href="https://www.cloudflare.com/turnstile-privacy-policy/"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4"
          >
            Turnstile Privacy Addendum
          </a>{" "}
          and{" "}
          <a
            href="https://www.cloudflare.com/policies/privacy/"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4"
          >
            Privacy Policy
          </a>
          . Provider-managed cookie names and durations may depend on the
          deployed configuration and need review before this draft is published.
        </p>
      </PolicySection>

      <PolicySection title="Browser controls and other storage">
        <p>
          MediaPeek has no in-app cookie settings. You can manage or delete
          cookies in your browser. Blocking the <code>theme</code> cookie may
          prevent the selected theme from being remembered. If Turnstile is
          enabled, blocking its grant cookie can require verification again.
        </p>
        <p>
          Saved Media Reports use IndexedDB in your browser; they are not
          cookies. Read the{" "}
          <Link to="/privacy" className="underline underline-offset-4">
            Privacy Policy
          </Link>{" "}
          for report storage and sharing details. The web app source does not
          configure analytics or advertising cookies. Confirm the production
          host and provider configuration before publication so any
          provider-managed cookies can be listed accurately.
        </p>
      </PolicySection>

      <PolicySection title="Review before publication">
        <p>
          Confirm the Cloudflare products and other services enabled for the
          production hostname, then verify any provider-managed cookie names,
          purposes, durations, and domains against that configuration.
        </p>
      </PolicySection>

      <PolicySection title="Related policies">
        <p>
          The{" "}
          <Link to="/privacy" className="underline underline-offset-4">
            Privacy Policy
          </Link>
          ,{" "}
          <Link to="/terms" className="underline underline-offset-4">
            Terms of Use
          </Link>
          , and{" "}
          <Link to="/usage" className="underline underline-offset-4">
            Usage Policy
          </Link>{" "}
          are part of this policy set. Product and legal review is required
          before publication.
        </p>
      </PolicySection>
    </PolicyLayout>
  )
}

export const Route = createFileRoute("/cookies")({
  head: () => ({
    meta: [
      { title: "Cookie Policy - MediaPeek" },
      {
        name: "description",
        content: "Cookies and browser storage used by the MediaPeek web app.",
      },
    ],
  }),
  component: CookiePolicy,
})
