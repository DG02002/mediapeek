import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';

/**
 * Announces page changes to screen readers.
 * React Router transitions are often silent to assistive technology.
 * This component mirrors the document title into a live region on navigation.
 */
export function RouteAnnouncer() {
  const location = useLocation();
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    // Small timeout to allow <Meta /> to update document.title first
    const timer = setTimeout(() => {
      if (document.title) {
        setAnnouncement(`Navigated to ${document.title}`);
      }
    }, 100);

    return () => {
      clearTimeout(timer);
    };
  }, [location.pathname, location.search]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    >
      {announcement}
    </div>
  );
}
