import { Link } from "react-router"

const CURRENT_YEAR = new Date().getFullYear()

const policyLinks = [
  { label: "Terms of use", to: "/terms" },
  { label: "Privacy policy", to: "/privacy" },
  { label: "Cookie policy", to: "/cookies" },
  { label: "Usage policy", to: "/usage" },
  { label: "Open-source licenses", to: "/licenses" },
] as const

export function Footer() {
  return (
    <footer className="bg-background">
      <div className="w-full px-6 md:px-8 lg:px-10 xl:px-14">
        <div className="grid grid-cols-2 gap-x-8 gap-y-12 pt-16 sm:grid-cols-4 md:pt-20">
          <nav
            aria-labelledby="footer-policies-heading"
            className="flex flex-col items-start gap-5"
          >
            <h2
              id="footer-policies-heading"
              className="text-sm font-normal text-muted-foreground"
            >
              Terms and policies
            </h2>
            <ul className="flex flex-col items-start gap-4">
              {policyLinks.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    viewTransition
                    className="text-sm text-foreground transition-opacity hover:opacity-70"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
      <div className="mt-16 w-full px-6 pt-5 pb-10 md:mt-20 md:px-8 md:pb-12 lg:px-10 xl:px-14">
        <p className="text-center text-sm text-muted-foreground">
          MediaPeek © {CURRENT_YEAR}
        </p>
      </div>
    </footer>
  )
}
