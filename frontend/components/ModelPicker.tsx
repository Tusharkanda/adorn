"use client";

import type { ModelLibraryEntry } from "@/lib/api";

const ANGLE_KEYS = ["front", "three_quarter", "closeup"] as const;
const ANGLE_LABEL: Record<(typeof ANGLE_KEYS)[number], string> = {
  front: "Front",
  three_quarter: "¾ view",
  closeup: "Close-up",
};

export default function ModelPicker({
  models,
  selectedId,
  onSelect,
}: {
  models: ModelLibraryEntry[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  if (models.length === 0) {
    return <p className="text-sm text-muted">No models available.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
      {models.map((model) => {
        const active = model.id === selectedId;
        return (
          <button
            key={model.id}
            type="button"
            onClick={() => onSelect(model.id)}
            className={`group overflow-hidden rounded-lg border bg-surface text-left transition ${
              active ? "border-rust ring-1 ring-rust" : "border-border hover:border-silver"
            }`}
          >
            <div className="grid grid-cols-3 gap-px bg-border">
              {ANGLE_KEYS.map((key) => {
                const url = model.base_image_urls[key];
                return (
                  <div key={key} className="relative aspect-[3/4] overflow-hidden bg-surface-sunken">
                    {url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={url}
                        alt={`${model.name} — ${ANGLE_LABEL[key]}`}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between px-3 py-2.5">
              <p className="text-sm font-medium text-foreground">{model.name}</p>
              {active && (
                <span className="eyebrow text-rust-dark">✓ Selected</span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
