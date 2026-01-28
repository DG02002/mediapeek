import { Link } from 'react-router';

export function Footer() {
  return (
    <footer className="bg-muted/50 border-t backdrop-blur-md">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-12">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-muted-foreground text-center text-sm font-medium">
            Copyright &copy; {new Date().getFullYear()} MediaPeek. All rights
            reserved.
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
  );
}
