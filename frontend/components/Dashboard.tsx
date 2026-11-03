"use client";

import { useEffect, useRef, useState } from "react";
import { getJob, listModels, type JobStatus, type ModelLibraryEntry } from "@/lib/api";
import StudioHeader from "./StudioHeader";
import ShootCard, { type Shoot } from "./ShootCard";
import ShootDetailModal from "./ShootDetailModal";
import NewShootWizard from "./NewShootWizard";

const ACTIVE_STATUSES = new Set<JobStatus["status"]>(["pending", "processing"]);
const POLL_INTERVAL_MS = 3000;
const SHOOT_LIMIT = 20;

export default function Dashboard({ email }: { email: string }) {
  const [models, setModels] = useState<ModelLibraryEntry[]>([]);
  const [shoots, setShoots] = useState<Shoot[]>([]);
  const [view, setView] = useState<"studio" | "wizard">("studio");
  const [filter, setFilter] = useState<"all" | "ready">("all");
  const [error, setError] = useState<string | null>(null);
  const [openJobId, setOpenJobId] = useState<number | null>(null);

  const pollTimers = useRef<Record<number, ReturnType<typeof setInterval>>>({});

  useEffect(() => {
    listModels().then(setModels).catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    const timers = pollTimers.current;
    return () => {
      Object.values(timers).forEach(clearInterval);
    };
  }, []);

  function pollJob(jobId: number) {
    pollTimers.current[jobId] = setInterval(async () => {
      try {
        const status = await getJob(jobId);
        setShoots((prev) =>
          prev.map((s) => (s.jobId === jobId ? { ...s, job: status } : s))
        );
        if (!ACTIVE_STATUSES.has(status.status)) {
          clearInterval(pollTimers.current[jobId]);
          delete pollTimers.current[jobId];
        }
      } catch {
        clearInterval(pollTimers.current[jobId]);
        delete pollTimers.current[jobId];
      }
    }, POLL_INTERVAL_MS);
  }

  function handleCreated(args: {
    jobId: number;
    title: string;
    modelName: string;
    occasion: string | null;
    productCutoutUrl: string;
  }) {
    setShoots((prev) => [
      {
        jobId: args.jobId,
        title: args.title,
        modelName: args.modelName,
        occasion: args.occasion,
        productCutoutUrl: args.productCutoutUrl,
        createdAt: Date.now(),
        job: {
          status: "pending",
          result_urls: null,
          placement_confidence: null,
          error: null,
        },
      },
      ...prev,
    ]);
    pollJob(args.jobId);
    setView("studio");
  }

  const readyCount = shoots.filter((s) => s.job.status === "complete").length;
  const visibleShoots = filter === "ready" ? shoots.filter((s) => s.job.status === "complete") : shoots;
  const openShoot = shoots.find((s) => s.jobId === openJobId) ?? null;

  if (view === "wizard") {
    return (
      <div className="min-h-screen bg-background">
        <StudioHeader email={email} />
        <NewShootWizard
          models={models}
          onExit={() => setView("studio")}
          onCreated={handleCreated}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <StudioHeader email={email} onNewShoot={() => setView("wizard")} />

      <main className="mx-auto max-w-6xl px-6 py-10 lg:px-10">
        {error && (
          <div className="mb-6 rounded-md border border-danger/30 bg-danger-bg px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        <p className="eyebrow">{email || "Your studio"}</p>
        <h1 className="mt-1 font-serif text-3xl text-foreground">Your work, in good light.</h1>
        <p className="mt-1 text-sm text-muted">
          A little studio for everything you&rsquo;re bringing into the world.
        </p>

        {shoots.length === 0 ? (
          <div className="mt-10 grid gap-8 rounded-lg border border-border bg-surface p-8 lg:grid-cols-[1.2fr_1fr] lg:p-12">
            <div>
              <p className="eyebrow">One photo. New possibilities.</p>
              <h2 className="mt-2 font-serif text-2xl text-foreground">
                A new chapter starts here.
              </h2>
              <p className="mt-2 text-sm text-muted">
                From your worktable to the world. Let&rsquo;s make your first shoot.
              </p>
              <h3 className="mt-6 font-serif text-lg text-foreground">
                Handmade by you. Seen on someone.
              </h3>
              <p className="mt-1 text-sm text-muted">
                Upload a photo of your piece, choose a model, and create imagery for your shop
                or your next Instagram post.
              </p>
              <button
                type="button"
                onClick={() => setView("wizard")}
                className="mt-6 rounded-md bg-rust px-5 py-2.5 text-sm font-medium text-[#faf6ec] transition hover:bg-rust-dark"
              >
                Upload your first product
              </button>
              <p className="mt-3 text-xs text-muted">
                No camera crew. No complicated setup. Just your product, beautifully in focus.
              </p>
            </div>
            <div className="hidden rounded-lg bg-surface-sunken lg:block" />
          </div>
        ) : (
          <>
            <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
              <div className="flex items-center gap-5 text-sm">
                <button
                  type="button"
                  onClick={() => setFilter("all")}
                  className={filter === "all" ? "font-medium text-foreground" : "text-muted"}
                >
                  All shoots {shoots.length}
                </button>
                <button
                  type="button"
                  onClick={() => setFilter("ready")}
                  className={filter === "ready" ? "font-medium text-foreground" : "text-muted"}
                >
                  Ready {readyCount}
                </button>
              </div>
              <span className="text-xs text-muted">Newest first</span>
            </div>

            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {visibleShoots.map((shoot) => (
                <ShootCard
                  key={shoot.jobId}
                  shoot={shoot}
                  onOpen={() => setOpenJobId(shoot.jobId)}
                />
              ))}
            </div>

            <p className="mt-10 text-center text-xs text-muted">
              {shoots.length} of {SHOOT_LIMIT} shoots used · Renews next billing cycle
            </p>
          </>
        )}

        <p className="mt-10 text-center text-xs text-muted">
          Your originals stay yours. Your finished images are ready for your shop.
        </p>
      </main>

      {openShoot && (
        <ShootDetailModal shoot={openShoot} onClose={() => setOpenJobId(null)} />
      )}
    </div>
  );
}
