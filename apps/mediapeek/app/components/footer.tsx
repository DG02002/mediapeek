import { Link } from "@tanstack/react-router"

const CURRENT_YEAR = new Date().getFullYear()

const policyLinks = [
  { label: "Terms", to: "/terms" },
  { label: "Privacy", to: "/privacy" },
  { label: "Cookies", to: "/cookies" },
  { label: "Usage", to: "/usage" },
  { label: "Open-source licenses", to: "/licenses" },
] as const

export function Footer() {
  return (
    <footer className="border-t">
      <div className="flex w-full flex-col gap-3 px-6 py-5 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between md:px-8 lg:px-10 xl:px-14">
        <p className="shrink-0">MediaPeek © {CURRENT_YEAR}</p>
        <nav aria-label="Policies">
          <ul className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {policyLinks.map((link, index) => (
              <li key={link.to} className="inline-flex items-center gap-2">
                <Link
                  to={link.to}
                  viewTransition
                  className="transition-opacity hover:opacity-70"
                >
                  {link.label}
                </Link>
                {index < policyLinks.length - 1 && (
                  <span aria-hidden="true">|</span>
                )}
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  )
}
