import { Outlet } from "react-router"

import { Footer } from "~/components/footer"
import { Header } from "~/components/header"
import { AnalysisQueueProvider } from "~/features/analyze/queue/use-analysis-queue"

export default function AppLayout() {
  return (
    <AnalysisQueueProvider>
      <div className="flex min-h-screen flex-col font-sans">
        <Header sticky={false} />
        <main className="flex w-full flex-1 flex-col gap-6 px-6 py-8 md:px-8 md:py-12 lg:px-10 xl:px-14">
          <Outlet />
        </main>
        <Footer />
      </div>
    </AnalysisQueueProvider>
  )
}
