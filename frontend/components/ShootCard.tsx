"use client";

import type { JobStatus } from "@/lib/api";

export type Shoot = {
  jobId: number;
  title: string;
  modelName: string;
  occasion: string | null;
  environmentLabel: string | null;
  productCutoutUrl: string;
  createdAt: number;
  job: JobStatus;
};

const STATUS_LABEL: Record<JobStatus["status"], string> = {
  pending: "Pending",
  processing: "Processing",
  complete: "Complete",
  needs_review: "Needs review",
  failed: "Failed",
};

const STATUS_ICON: Record<JobStatus["status"], string> = {
  pending: "◌",
  processing: "◌",
  complete: "✓",
  needs_review: "!",
  failed: "✕",
};

const STATUS_CLASS: Record<JobStatus["status"], string> = {
  pending: "bg-surface-sunken text-muted",
  processing: "bg-amber-bg text-amber",
  complete: "bg-success-bg text-success",
  needs_review: "bg-amber-bg text-amber",
  failed: "bg-danger-bg text-danger",
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Today, ${hrs}h ago`;
  return "Earlier";
}

export default function ShootCard({
  shoot,
  onOpen,
}: {
  shoot: Shoot;
  onOpen: () => void;
}) {
  const { job } = shoot;
  const resultEntries = job.result_urls ? Object.entries(job.result_urls) : [];
  const heroUrl = resultEntries[0]?.[1] ?? shoot.productCutoutUrl;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="block w-full overflow-hidden rounded-lg border border-border bg-surface text-left transition hover:border-silver"
    >
      <div className="grid grid-cols-2 gap-px bg-border">
        <div className="aspect-[3/4] overflow-hidden bg-surface-sunken">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={heroUrl}
            alt={shoot.title}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="aspect-[3/4] overflow-hidden bg-surface-sunken">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={shoot.productCutoutUrl}
            alt={`${shoot.title} — original`}
            className="h-full w-full object-contain p-3"
          />
        </div>
      </div>

      <div className="p-4">
        <p className="eyebrow">
          {resultEntries.length > 0
            ? `${resultEntries.length} image${resultEntries.length > 1 ? "s" : ""}`
            : "On-model result · Original"}
        </p>
        <h3 className="mt-1 font-serif text-base text-foreground">{shoot.title}</h3>
        <p className="mt-0.5 text-sm text-muted">
          Model: {shoot.modelName}
          {shoot.occasion && <span className="capitalize"> · {shoot.occasion}</span>}
          {shoot.environmentLabel && <span> · {shoot.environmentLabel}</span>}
        </p>

        <div className="mt-3 flex items-center justify-between">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASS[job.status]}`}
          >
            <span>{STATUS_ICON[job.status]}</span>
            {STATUS_LABEL[job.status]}
          </span>
          <span className="text-xs text-muted">{timeAgo(shoot.createdAt)}</span>
        </div>

        {job.error && <p className="mt-2 text-xs text-danger">{job.error}</p>}

        {job.status === "needs_review" && (
          <p className="mt-2 text-xs text-amber">Jewelry beta · Check the fit ↗</p>
        )}
        {job.status === "failed" && !job.error && (
          <p className="mt-2 text-xs text-danger">Photo too dark · Try again ↗</p>
        )}

        {job.placement_confidence !== null && job.placement_confidence !== undefined && (
          <p className="mt-2 text-xs text-muted">
            Placement confidence: {(job.placement_confidence * 100).toFixed(0)}%
          </p>
        )}
      </div>
    </button>
  );
}
