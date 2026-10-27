import { Link } from "react-router-dom";
import { siteTitle, useConfig } from "../lib/config";

export function Logo({ to = "/" }: { to?: string }) {
  const config = useConfig();
  return (
    <Link to={to} className="flex items-center gap-2.5 font-semibold text-ink">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M22 10 12 5 2 10l10 5 10-5z" />
          <path d="M6 12v5c3 2 9 2 12 0v-5" />
        </svg>
      </span>
      <span className="truncate">{siteTitle(config)}</span>
    </Link>
  );
}
