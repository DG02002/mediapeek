import { Footer } from "~/components/footer"
import { Header } from "~/components/header"
import { MediaForm } from "~/features/analyze/media-form"
import { ReportsSection } from "~/features/library/reports-section"
import { useHydrated } from "~/hooks/use-hydrated"

import type { Route } from "./+types/route"

export const meta: Route.MetaFunction = () => {
  return [
    { title: "App - MediaPeek" },
    {
      name: "description",
      content:
        "Analyze media files directly in your browser using Cloudflare Workers and MediaInfo.js.",
    },
  ]
}

export default function AppRoute() {
  const isHydrated = useHydrated()

  return (
    <div className="flex min-h-screen flex-col font-sans">
      <Header sticky={false} />
      <main className="flex w-full flex-1 flex-col gap-6 px-6 py-8 md:px-8 md:py-12 lg:px-10 xl:px-14">
        {isHydrated ? (
          <>
            <MediaForm />
            <ReportsSection />
          </>
        ) : (
          <div className="flex w-full max-w-3xl animate-pulse flex-col gap-8 py-8">
            <div className="bg-muted/20 h-32 w-full rounded-lg" />
            <div className="bg-muted/20 h-64 w-full rounded-lg" />
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}
