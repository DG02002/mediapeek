import { Link } from 'react-router';

import { Footer } from '~/components/footer';
import { Header } from '~/components/header';

import type { Route } from './+types/route';

export const meta: Route.MetaFunction = () => [
  { title: 'Terms of Use - MediaPeek' },
  {
    name: 'description',
    content: 'Terms of Use for MediaPeek services.',
  },
];

export default function TermsOfUse() {
  return (
    <div className="flex min-h-screen flex-col font-sans">
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-12 sm:px-12">
        <div className="mb-10">
          <Header align="center" />
        </div>

        <div className="mx-auto w-full space-y-10">
          <div className="bg-background/95 supports-backdrop-filter:bg-background/60 sticky top-0 z-50 -mx-4 flex flex-col gap-4 px-4 pt-4 pb-0 backdrop-blur-md transition-all sm:-mx-12 sm:px-12">
            <h1 className="scroll-m-20 text-3xl font-extrabold tracking-tight lg:text-4xl">
              Terms of Use
            </h1>
            <div className="bg-border h-px w-full" />
          </div>

          <div className="mt-6! flex items-center gap-2">
            <span className="bg-muted text-muted-foreground rounded-md px-2 py-1 text-sm font-medium">
              Last Updated: January 27, 2026
            </span>
          </div>

          <p className="text-muted-foreground text-xl">
            THIS LEGAL AGREEMENT BETWEEN YOU AND MEDIAPEEK GOVERNS YOUR USE OF
            THE MEDIAPEEK PRODUCT, SOFTWARE, SERVICES, AND WEBSITES
            (COLLECTIVELY REFERRED TO AS THE “SERVICE”). IT IS IMPORTANT THAT
            YOU READ AND UNDERSTAND THE FOLLOWING TERMS.
          </p>

          <section className="space-y-4">
            <h2 className="scroll-m-20 text-3xl font-semibold tracking-tight first:mt-0">
              I. Acceptance of Terms
            </h2>
            <p className="leading-7 not-first:mt-6">
              By accessing or using the Service, you agree to be bound by these
              Terms of Use (&quot;Terms&quot;). If you do not agree to these
              Terms, please do not use the Service.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="scroll-m-20 text-3xl font-semibold tracking-tight">
              II. Description of Service
            </h2>
            <p className="leading-7 not-first:mt-6">
              MediaPeek provides a web-based tool that allows users to analyze
              media files via public URLs to retrieve technical metadata. The
              Service uses Cloudflare Workers and MediaInfo.js to process these
              requests.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="scroll-m-20 text-3xl font-semibold tracking-tight">
              III. User Responsibilities
            </h2>
            <p className="leading-7 not-first:mt-6">
              You represent and warrant that:
            </p>
            <ol className="my-6 ml-6 list-decimal [&>li]:mt-2">
              <li>
                You have the legal right to access and analyze the media files
                via the URLs you provide.
              </li>
              <li>
                You will not use the Service for any illegal or unauthorized
                purpose, including but not limited to copyright infringement.
              </li>
              <li>
                You will not use any &quot;deep-link&quot;,
                &quot;page-scrape&quot;, &quot;robot&quot;, &quot;spider&quot;
                or other automatic device, program, algorithm or methodology, or
                any similar or equivalent manual process, to access, acquire,
                copy or monitor any portion of the Service.
              </li>
              <li>
                You will not attempt to gain unauthorized access to any portion
                or feature of the Service, or any other systems or networks
                connected to the Service, by hacking, password
                &quot;mining&quot; or any other illegitimate means.
              </li>
              <li>
                You will not probe, scan or test the vulnerability of the
                Service or any network connected to the Service, nor breach the
                security or authentication measures on the Service.
              </li>
            </ol>
          </section>

          <section className="space-y-4">
            <h2 className="scroll-m-20 text-3xl font-semibold tracking-tight">
              IV. Feedback and Information
            </h2>
            <p className="leading-7 not-first:mt-6">
              Any feedback you provide at this site shall be deemed to be
              non-confidential. MediaPeek shall be free to use such information
              on an unrestricted basis. By submitting feedback, you grant
              MediaPeek a perpetual, irrevocable, worldwide, royalty-free
              license to use and publish your feedback for any purpose.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="scroll-m-20 text-3xl font-semibold tracking-tight">
              V. Privacy and Data Processing
            </h2>
            <p className="leading-7 not-first:mt-6">
              Your use of the Service is also governed by our{' '}
              <Link
                to="/privacy"
                className="font-medium underline underline-offset-4"
              >
                Privacy Policy
              </Link>
              . You understand that by using the Service, you consent to the
              collection and use of information as set forth in the Privacy
              Policy, including the processing of URL data by our serverless
              infrastructure.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="scroll-m-20 text-3xl font-semibold tracking-tight">
              VI. Intellectual Property & Open Source License
            </h2>
            <p className="leading-7 not-first:mt-6">
              The Service&apos;s source code is open source and available under
              the <strong>GNU General Public License v3.0 (GPLv3)</strong>.
              Under this license:
            </p>
            <ul className="my-6 ml-6 list-disc [&>li]:mt-2">
              <li>
                <strong>Freedom to Use:</strong> Anyone can copy, modify, and
                distribute this software, and use it commercially or privately.
              </li>
              <li>
                <strong>Copyleft:</strong> If you modify this code and
                distribute it, you must license your modifications under the
                same GPLv3 license.
              </li>
              <li>
                <strong>Attribution:</strong> You must include the original
                license and copyright notice with every distribution.
              </li>
              <li>
                <strong>No Warranty:</strong> This software is provided without
                warranty. Neither the author nor the license holder can be held
                liable for damages.
              </li>
            </ul>
            <p className="leading-7 not-first:mt-6">
              The metadata extracted from your media files belongs to you or the
              respective copyright holders of the media files. MediaPeek lays no
              claim to the content you analyze.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="scroll-m-20 text-3xl font-semibold tracking-tight">
              VII. Indemnity
            </h2>
            <p className="leading-7 not-first:mt-6">
              You agree to indemnify and hold MediaPeek and its contributors
              harmless from any demands, loss, liability, claims or expenses
              (including attorneys&apos; fees), made against MediaPeek by any
              third party due to or arising out of or in connection with your
              use of the Service.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="scroll-m-20 text-3xl font-semibold tracking-tight">
              VIII. Disclaimer of Warranties
            </h2>
            <p className="leading-7 uppercase not-first:mt-6">
              The Service is provided &quot;AS IS&quot; and &quot;AS
              AVAILABLE&quot; without warranties of any kind, either express or
              implied, including, but not limited to, implied warranties of
              merchantability, fitness for a particular purpose, or
              non-infringement. MediaPeek does not warrant that the Service will
              be uninterrupted, secure, or error-free.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="scroll-m-20 text-3xl font-semibold tracking-tight">
              IX. Limitation of Liability
            </h2>
            <p className="leading-7 uppercase not-first:mt-6">
              To the maximum extent permitted by law, MediaPeek shall not be
              liable for any indirect, incidental, special, consequential, or
              punitive damages, or any loss of profits or revenues, whether
              incurred directly or indirectly, arising out of your use of the
              Service or any media files analyzed through it.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
