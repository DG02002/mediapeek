import { Footer } from '~/components/footer';
import { Header } from '~/components/header';

import type { Route } from './+types/route';

export const meta: Route.MetaFunction = () => [
  { title: 'Privacy Policy - MediaPeek' },
  {
    name: 'description',
    content: 'Privacy Policy for MediaPeek - Learn how we handle your data.',
  },
];

export default function PrivacyPolicy() {
  return (
    <div className="flex min-h-screen flex-col font-sans">
      <Header />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-12 sm:px-12">
        <div className="mx-auto w-full space-y-10">
          <div className="-mx-4 flex flex-col gap-4 px-4 pt-4 pb-0 sm:-mx-12 sm:px-12">
            <h1 className="scroll-m-20 text-3xl font-extrabold tracking-tight lg:text-4xl">
              Privacy Policy
            </h1>
            <div className="bg-border h-px w-full" />
          </div>

          <div className="mt-6! flex items-center gap-2">
            <span className="bg-muted text-muted-foreground rounded-md px-2 py-1 text-sm font-medium">
              Last Updated: January 27, 2026
            </span>
          </div>

          <section className="space-y-4">
            <h2 className="scroll-m-20 text-3xl font-semibold tracking-tight first:mt-0">
              What Is Personal Data at MediaPeek?
            </h2>
            <p className="leading-7 not-first:mt-6">
              We consider &quot;personal data&quot; to be any data that relates
              to an identified or identifiable individual. Due to the nature of
              our Service, we primarily process technical data (URLs) which may
              or may not contain personal identifiers depending on how you
              structure them.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="scroll-m-20 text-3xl font-semibold tracking-tight">
              Your Privacy Rights at MediaPeek
            </h2>
            <p className="leading-7 not-first:mt-6">
              At MediaPeek, we respect your ability to know, access, correct,
              transfer, restrict the processing of, and delete your personal
              data. Because we do not maintain user accounts or persistent
              storage of your analyses, we generally do not hold personal data
              that can be retrieved or deleted upon request.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="scroll-m-20 text-3xl font-semibold tracking-tight">
              Personal Data MediaPeek Collects from You
            </h2>
            <p className="leading-7 not-first:mt-6">
              When you use MediaPeek, we may collect the following limited data:
            </p>
            <ul className="my-6 ml-6 list-disc [&>li]:mt-2">
              <li>
                <strong>Usage Data:</strong> Information about how you use the
                Service, such as the URLs submitted for analysis and the
                technical metadata generated.
              </li>
              <li>
                <strong>Clipboard Access:</strong> MediaPeek may read your
                clipboard to auto-detect media URLs when you focus the input
                field. This data is processed locally in your browser and is not
                transmitted to our servers unless you submit the URL for
                analysis.
              </li>
              <li>
                <strong>Request Metadata:</strong> IP addresses, browser type,
                and timestamps, which are processed by our infrastructure
                provider (Cloudflare) for security and analytics purposes.
              </li>
              <li>
                <strong>Security Tokens:</strong> CAPTCHA or Turnstile tokens
                used to verify that requests are made by humans.
              </li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="scroll-m-20 text-3xl font-semibold tracking-tight">
              MediaPeek’s Use of Personal Data
            </h2>
            <p className="leading-7 not-first:mt-6">
              We use the data we collect for the following purposes:
            </p>
            <ul className="my-6 ml-6 list-disc [&>li]:mt-2">
              <li>
                <strong>Providing the Service:</strong> To fetch the media file
                from the URL you provide and extract its metadata.
              </li>
              <li>
                <strong>Security and Fraud Prevention:</strong> To detect and
                prevent abuse of our Service (e.g., bot attacks).
              </li>
              <li>
                <strong>Infrastructure Maintenance:</strong> To monitor the
                performance and stability of our serverless workers.
              </li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="scroll-m-20 text-3xl font-semibold tracking-tight">
              MediaPeek’s Sharing of Personal Data
            </h2>
            <p className="leading-7 not-first:mt-6">
              We do not sell your personal data. We share data only with our
              trusted infrastructure provider:
            </p>
            <ul className="my-6 ml-6 list-disc [&>li]:mt-2">
              <li>
                <strong>Cloudflare:</strong> We use Cloudflare for hosting, edge
                computing (Workers), and security (Turnstile). Data processed by
                MediaPeek flows through Cloudflare&apos;s network.
              </li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="scroll-m-20 text-3xl font-semibold tracking-tight">
              Protection of Personal Data at MediaPeek
            </h2>
            <p className="leading-7 not-first:mt-6">
              We implement robust security measures to protect your data.
              importantly:
            </p>
            <ul className="my-6 ml-6 list-disc [&>li]:mt-2">
              <li>
                <strong>Ephemeral Processing:</strong> We{' '}
                <strong>do not</strong> store the media files you analyze. They
                are fetched temporarily by our servers solely for the purpose of
                extracting metadata and are discarded immediately after
                processing.
              </li>
              <li>
                <strong>No Long-term Logs:</strong> We do not build long-term
                profiles of user activity.
              </li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="scroll-m-20 text-3xl font-semibold tracking-tight">
              Cookies and Other Technologies
            </h2>
            <p className="leading-7 not-first:mt-6">
              We use essential technologies for the operation of the Service:
            </p>
            <ul className="my-6 ml-6 list-disc [&>li]:mt-2">
              <li>
                <strong>Local Storage:</strong> We may use local storage on your
                device to save your preferences (such as theme headers).
              </li>
              <li>
                <strong>Security Cookies:</strong> Our providers (like
                Cloudflare) may place cookies to detect malicious traffic.
              </li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="scroll-m-20 text-3xl font-semibold tracking-tight">
              Transfer of Personal Data Between Countries
            </h2>
            <p className="leading-7 not-first:mt-6">
              MediaPeek’s services connect you to the world. To make that
              possible, your personal data may be transferred to or accessed by
              entities around the world, including Cloudflare’s distributed data
              centers. MediaPeek complies with laws on the transfer of personal
              data between countries to help ensure your data is protected,
              wherever it may be.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="scroll-m-20 text-3xl font-semibold tracking-tight">
              Our Commitment to Your Privacy
            </h2>
            <p className="leading-7 not-first:mt-6">
              To ensure your personal data is secure, MediaPeek is built with
              privacy-first principles. As an open-source project, our code is
              publicly auditable, and privacy safeguards are baked into the
              architecture from the ground up.
            </p>
          </section>

          <div className="bg-border h-px w-full" />

          <section className="space-y-4">
            <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
              Privacy Questions
            </h3>
            <p className="leading-7 not-first:mt-6">
              If you have any questions about this Privacy Policy or our
              practices, please contact us via our GitHub repository issues
              page.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
