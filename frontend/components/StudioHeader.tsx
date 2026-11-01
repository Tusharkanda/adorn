"use client";

import { supabase } from "@/lib/supabase";

export default function StudioHeader({
  email,
  onNewShoot,
}: {
  email: string;
  onNewShoot?: () => void;
}) {
  const initials = email ? email.slice(0, 2).toUpperCase() : "YO";

  return (
    <header className="flex items-center justify-between border-b border-border px-6 py-4 lg:px-10">
      <div className="flex items-center gap-8">
        <p className="font-serif text-xl lowercase tracking-wide text-foreground">
          adorn
        </p>
        <nav className="hidden items-center gap-6 text-sm text-muted sm:flex">
          <span className="font-medium text-foreground">Your studio</span>
          <a href="#" className="hover:text-foreground">
            The field notes ↗
          </a>
        </nav>
      </div>

      <div className="flex items-center gap-4">
        {onNewShoot && (
          <button
            type="button"
            onClick={onNewShoot}
            className="rounded-md bg-rust px-4 py-2 text-sm font-medium text-[#faf6ec] transition hover:bg-rust-dark"
          >
            New shoot
          </button>
        )}
        <button
          type="button"
          onClick={() => supabase.auth.signOut()}
          title={email}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-sunken text-xs font-medium text-foreground"
        >
          {initials}
        </button>
      </div>
    </header>
  );
}
