import type { ReactNode } from "react"

import { Footer } from "~/components/footer"
import { Header } from "~/components/header"

interface PolicyLayoutProps {
  title: string
  description: string
  children: ReactNode
  showReviewStatus?: boolean
}

export function PolicyLayout({
  title,
  description,
  children,
  showReviewStatus = true,
}: PolicyLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col font-sans">
      <Header />
      <main className="w-full flex-1 px-6 py-12 md:px-8 lg:px-10 xl:px-14">
        <header className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 text-center">
          <time dateTime="2026-10-18" className="text-muted-foreground text-sm">
            Updated October 18, 2026
          </time>
          {showReviewStatus && (
            <span className="bg-muted text-muted-foreground rounded-full px-3 py-1 text-xs font-medium">
              Draft for product and legal review
            </span>
          )}
          <h1 className="py-4 text-4xl font-normal text-balance md:py-6 md:text-6xl">
            {title}
          </h1>
          <p className="text-muted-foreground max-w-xl text-base leading-7">
            {description}
          </p>
        </header>
        <article className="mx-auto mt-12 w-full max-w-2xl space-y-10 text-base leading-7">
          {children}
        </article>
      </main>
      <Footer />
    </div>
  )
}

export function PolicySection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  )
}
