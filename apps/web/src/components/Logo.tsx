import { Link } from "react-router-dom";
import { siteTitle, useConfig } from "../lib/config";
import { AtomMark } from "./Physics";
import { cx } from "./ui";

export function Logo({ to = "/", dark }: { to?: string; dark?: boolean }) {
  const config = useConfig();
  return (
    <Link to={to} className={cx("group flex min-w-0 items-center gap-2.5", dark ? "text-white" : "text-ink")}>
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cosmos-900 text-brand-300 shadow-[0_6px_16px_-6px_rgb(67_83_240/0.7)] ring-1 ring-white/10">
        <AtomMark className="h-6 w-6 transition-transform duration-700 group-hover:rotate-180" />
      </span>
      <span className="truncate font-display text-[13px] sm:text-[15px] font-semibold tracking-tight">{siteTitle(config)}</span>
    </Link>
  );
}
