"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AuthForm() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [magicSubmitting, setMagicSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setSubmitting(true);

    const { error } =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    setSubmitting(false);

    if (error) {
      setError(error.message);
      return;
    }
    if (mode === "signup") {
      setNotice("Account created. Check your email to confirm, then sign in.");
    }
  }

  async function handleMagicLink() {
    if (!email) {
      setError("Enter your email address first.");
      return;
    }
    setError(null);
    setNotice(null);
    setMagicSubmitting(true);
    const { error } = await supabase.auth.signInWithOtp({ email });
    setMagicSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    setNotice("Check your inbox for a magic link.");
  }

  const isSignin = mode === "signin";

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left panel — brand / imagery */}
      <div className="relative hidden w-[44%] flex-col justify-between overflow-hidden bg-[#2b241b] px-12 py-12 text-[#f4efe3] lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(120% 90% at 20% 10%, rgba(177,80,46,0.45), transparent 60%), radial-gradient(120% 90% at 85% 90%, rgba(120,110,80,0.5), transparent 55%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(180deg, rgba(36,31,24,0.1), rgba(36,31,24,0.75))",
          }}
        />

        <p className="eyebrow relative z-10 text-[#e8dfca]">
          Your craft. Beautifully seen.
        </p>

        <div className="relative z-10 max-w-sm">
          <p className="eyebrow mb-3 text-[#e8dfca]">
            Small label. Big presence.
          </p>
          <h2 className="font-serif text-3xl leading-tight text-[#faf6ec]">
            You make the beautiful things. We help them find their people.
          </h2>
          <p className="mt-4 text-sm text-[#d8cfba]">
            Thoughtful AI on-model imagery for independent apparel and jewelry
            designers.
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex w-full flex-1 flex-col justify-center px-6 py-12 sm:px-12 lg:px-20">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-10">
            <p className="font-serif text-2xl lowercase tracking-wide text-foreground">
              adorn
            </p>
            <p className="eyebrow mt-1">Back to your studio</p>
          </div>

          <h1 className="font-serif text-3xl text-foreground">
            {isSignin ? "Welcome back." : "Let your work shine."}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {isSignin
              ? "Your next collection is waiting to be seen."
              : "Beautiful on-model imagery starts with one product photo. No studio required."}
          </p>

          <form onSubmit={handleSubmit} className="mt-8">
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
              Email address
            </label>
            <input
              type="email"
              required
              placeholder="you@yourlabel.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mb-4 w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none focus:border-rust"
            />

            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
              Password
            </label>
            <input
              type="password"
              required
              minLength={6}
              placeholder={
                isSignin ? "Enter your password" : "Create a password (8+ characters)"
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none focus:border-rust"
            />

            {isSignin && (
              <div className="mt-2 text-right">
                <button
                  type="button"
                  className="text-xs text-muted hover:text-rust-dark hover:underline"
                >
                  Forgot password?
                </button>
              </div>
            )}

            {error && <p className="mt-4 text-sm text-danger">{error}</p>}
            {notice && <p className="mt-4 text-sm text-rust-dark">{notice}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="mt-6 w-full rounded-md bg-rust px-4 py-2.5 text-sm font-medium text-[#faf6ec] transition hover:bg-rust-dark disabled:opacity-60"
            >
              {submitting
                ? "Please wait…"
                : isSignin
                ? "Sign in"
                : "Create your studio"}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <button
            type="button"
            onClick={handleMagicLink}
            disabled={magicSubmitting}
            className="w-full rounded-md border border-border bg-surface px-4 py-2.5 text-sm font-medium text-foreground transition hover:border-rust disabled:opacity-60"
          >
            {magicSubmitting ? "Sending…" : "Email me a magic link"}
          </button>
          <p className="mt-2 text-center text-xs text-muted">
            No password to remember. Just a link in your inbox.
          </p>

          <p className="mt-8 text-center text-sm text-muted">
            {isSignin ? "New to Adorn?" : "Already have a studio?"}{" "}
            <button
              type="button"
              onClick={() => {
                setMode(isSignin ? "signup" : "signin");
                setError(null);
                setNotice(null);
              }}
              className="font-medium text-rust-dark hover:underline"
            >
              {isSignin ? "Create your studio →" : "Sign in →"}
            </button>
          </p>

          <p className="mt-10 text-center text-xs text-muted">
            A considered space for independent makers.
          </p>
        </div>
      </div>
    </div>
  );
}
