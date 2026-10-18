import { Link } from "react-router"

const CURRENT_YEAR = new Date().getFullYear()

export function Footer() {
  return (
    <footer className="bg-muted/50 border-t backdrop-blur-md">
      <div className="w-full px-6 py-6 md:px-8 lg:px-10 xl:px-14">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-muted-foreground text-center text-sm font-medium">
            Copyright &copy; {CURRENT_YEAR} MediaPeek. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-sm font-medium">
            <Link
              to="/privacy"
              viewTransition
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Privacy Policy
            </Link>
            <span className="text-muted-foreground/30">|</span>
            <Link
              to="/terms"
              viewTransition
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Terms of Use
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
