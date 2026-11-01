"use client";

import { useEffect, useState } from "react";
import type { Shoot } from "./ShootCard";

async function downloadImage(url: string, filename: string) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    window.open(url, "_blank", "noreferrer");
  }
}

export default function ShootDetailModal({
  shoot,
  onClose,
}: {
  shoot: Shoot;
  onClose: () => void;
}) {
  const resultEntries = shoot.job.result_urls ? Object.entries(shoot.job.result_urls) : [];
  const [activeUrl, setActiveUrl] = useState<string>(
    resultEntries[0]?.[1] ?? shoot.productCutoutUrl
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-surface sm:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex min-h-[320px] flex-1 items-center justify-center bg-surface-sunken p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={activeUrl}
            alt={shoot.title}
            className="max-h-[70vh] w-full object-contain"
          />
        </div>

        <div className="flex w-full flex-col p-6 sm:w-72">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-serif text-lg text-foreground">{shoot.title}</h2>
              <p className="text-sm text-muted">Model: {shoot.modelName}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-muted hover:text-foreground"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {resultEntries.length > 0 && (
            <>
              <p className="eyebrow mt-6 mb-2">Results</p>
              <div className="grid grid-cols-3 gap-2">
                {resultEntries.map(([key, url]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveUrl(url)}
                    className={`aspect-square overflow-hidden rounded-md border ${
                      activeUrl === url ? "border-rust ring-1 ring-rust" : "border-border"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={key} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </>
          )}

          <p className="eyebrow mt-6 mb-2">Original</p>
          <button
            type="button"
            onClick={() => setActiveUrl(shoot.productCutoutUrl)}
            className={`aspect-square w-16 overflow-hidden rounded-md border ${
              activeUrl === shoot.productCutoutUrl
                ? "border-rust ring-1 ring-rust"
                : "border-border"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={shoot.productCutoutUrl}
              alt="Original cutout"
              className="h-full w-full object-contain"
            />
          </button>

          {shoot.job.placement_confidence !== null &&
            shoot.job.placement_confidence !== undefined && (
              <p className="mt-6 text-xs text-muted">
                Placement confidence:{" "}
                {(shoot.job.placement_confidence * 100).toFixed(0)}%
              </p>
            )}

          {shoot.job.error && (
            <p className="mt-4 text-sm text-danger">{shoot.job.error}</p>
          )}

          <div className="mt-auto flex flex-col gap-2 pt-6">
            <button
              type="button"
              onClick={() =>
                downloadImage(
                  activeUrl,
                  `${shoot.title.replace(/\s+/g, "-").toLowerCase()}.png`
                )
              }
              className="w-full rounded-md bg-rust px-4 py-2.5 text-sm font-medium text-[#faf6ec] transition hover:bg-rust-dark"
            >
              Download image
            </button>
            <a
              href={activeUrl}
              target="_blank"
              rel="noreferrer"
              className="w-full rounded-md border border-border px-4 py-2.5 text-center text-sm font-medium text-foreground hover:border-silver"
            >
              Open full size ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
