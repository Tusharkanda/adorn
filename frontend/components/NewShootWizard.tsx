"use client";

import { useRef, useState } from "react";
import { createJob, uploadProduct, type ModelLibraryEntry } from "@/lib/api";
import ModelPicker from "./ModelPicker";

const STEPS = ["Upload product", "Choose model", "Create imagery"] as const;

export default function NewShootWizard({
  models,
  onExit,
  onCreated,
}: {
  models: ModelLibraryEntry[];
  onExit: () => void;
  onCreated: (args: {
    jobId: number;
    title: string;
    modelName: string;
    productCutoutUrl: string;
  }) => void;
}) {
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState<"apparel" | "jewelry">("apparel");
  const [file, setFile] = useState<File | null>(null);
  const [cutoutUrl, setCutoutUrl] = useState<string | null>(null);
  const [productId, setProductId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [modelId, setModelId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedModel = models.find((m) => m.id === modelId) ?? null;

  async function handleFile(selected: File | null) {
    if (!selected) return;
    setFile(selected);
    setError(null);
    setUploading(true);
    try {
      const result = await uploadProduct(selected, category);
      setProductId(result.product_id);
      setCutoutUrl(result.cutout_image_url);
    } catch (e) {
      setError(String(e));
      setFile(null);
    } finally {
      setUploading(false);
    }
  }

  function resetUpload() {
    setFile(null);
    setCutoutUrl(null);
    setProductId(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleCreate() {
    if (!productId || !modelId || !selectedModel) return;
    setError(null);
    setCreating(true);
    try {
      const { job_id } = await createJob(productId, modelId);
      onCreated({
        jobId: job_id,
        title: file?.name.replace(/\.[^.]+$/, "") ?? "Untitled shoot",
        modelName: selectedModel.name,
        productCutoutUrl: cutoutUrl!,
      });
    } catch (e) {
      setError(String(e));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 lg:px-10">
      <div className="mb-8 flex items-center justify-between">
        <ol className="flex items-center gap-2 text-sm">
          {STEPS.map((label, i) => {
            const n = i + 1;
            const done = n < step;
            const current = n === step;
            return (
              <li key={label} className="flex items-center gap-2">
                {i > 0 && <span className="text-border">—</span>}
                <span
                  className={`flex items-center gap-1.5 ${
                    current
                      ? "font-medium text-foreground"
                      : done
                      ? "text-muted"
                      : "text-silver"
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                      current
                        ? "bg-rust text-[#faf6ec]"
                        : done
                        ? "bg-foreground text-background"
                        : "border border-border"
                    }`}
                  >
                    {done ? "✓" : n}
                  </span>
                  {label}
                </span>
              </li>
            );
          })}
        </ol>
        <button
          type="button"
          onClick={onExit}
          className="text-sm text-muted hover:text-foreground"
        >
          Save & exit
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-md border border-danger/30 bg-danger-bg px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {step === 1 && (
        <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr]">
          <section>
            <h1 className="font-serif text-2xl text-foreground">Start with your piece.</h1>
            <p className="mt-1 text-sm text-muted">
              One good photo is all you need. We&rsquo;ll take care of the background.
            </p>

            <p className="eyebrow mt-6 mb-2">01 / Product photo · One product per shoot</p>
            {!cutoutUrl ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface px-6 py-14 text-center">
                <p className="text-sm text-foreground">Drop your product photo here</p>
                <p className="mt-1 text-xs text-muted">Or choose a file from your computer.</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                />
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-5 rounded-md bg-rust px-4 py-2 text-sm font-medium text-[#faf6ec] transition hover:bg-rust-dark disabled:opacity-60"
                >
                  {uploading ? "Uploading…" : "Choose photo"}
                </button>
                <p className="mt-3 text-xs text-muted">JPG, PNG or HEIC · Up to 20 MB</p>
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-surface p-4">
                <div className="flex items-center justify-between">
                  <p className="eyebrow">Background removed</p>
                  <button
                    type="button"
                    onClick={resetUpload}
                    className="text-xs font-medium text-rust-dark hover:underline"
                  >
                    Replace photo
                  </button>
                </div>
                <div className="mt-3 flex items-center gap-4">
                  <div className="h-32 w-32 shrink-0 overflow-hidden rounded-md border border-border bg-surface-sunken">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={cutoutUrl} alt="Cutout" className="h-full w-full object-contain" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{file?.name}</p>
                    <p className="text-xs text-muted">
                      {file ? `${(file.size / 1_000_000).toFixed(1)} MB` : ""} · Ready
                    </p>
                    <p className="mt-2 text-xs text-muted">
                      This is the exact cutout we&rsquo;ll place on your model.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <p className="eyebrow mt-8 mb-2">02 / What are you photographing?</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setCategory("apparel")}
                className={`rounded-lg border p-4 text-left transition ${
                  category === "apparel" ? "border-rust ring-1 ring-rust" : "border-border"
                }`}
              >
                <p className="text-sm font-medium text-foreground">
                  Apparel {category === "apparel" && "✓"}
                </p>
                <p className="mt-1 text-xs text-muted">
                  Clothing fitted to the model&rsquo;s body. Best for clear silhouettes and
                  visible fabric detail.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setCategory("jewelry")}
                className={`rounded-lg border p-4 text-left transition ${
                  category === "jewelry" ? "border-rust ring-1 ring-rust" : "border-border"
                }`}
              >
                <p className="text-sm font-medium text-foreground">
                  Jewelry {category === "jewelry" && "✓"}
                  <span className="eyebrow ml-2 text-amber">Beta</span>
                </p>
                <p className="mt-1 text-xs text-muted">
                  Small pieces placed on ears, necks or hands. Fine details and fit may need
                  review.
                </p>
              </button>
            </div>
          </section>

          <aside>
            <div className="rounded-lg border border-border bg-surface p-5">
              <p className="font-serif text-base text-foreground">
                A little light goes a long way.
              </p>
              <ul className="mt-3 space-y-2 text-sm text-muted">
                <li>• Use soft, even daylight.</li>
                <li>• Keep the whole piece in frame.</li>
                <li>• Choose a plain, uncluttered background.</li>
              </ul>
            </div>
            <div className="mt-6 flex items-center justify-between">
              <p className="text-xs text-muted">
                {cutoutUrl
                  ? "Your piece is ready for its close up."
                  : "Choose a photo to continue."}
              </p>
            </div>
            <button
              type="button"
              disabled={!productId}
              onClick={() => setStep(2)}
              className="mt-3 w-full rounded-md bg-rust px-4 py-2.5 text-sm font-medium text-[#faf6ec] transition hover:bg-rust-dark disabled:opacity-40"
            >
              Choose a model →
            </button>
          </aside>
        </div>
      )}

      {step === 2 && (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h1 className="font-serif text-2xl text-foreground">Find your kind of muse.</h1>
              <p className="mt-1 text-sm text-muted">
                Six distinct faces. Three angles each. Choose who feels right for your label.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-sm text-muted hover:text-foreground"
            >
              ← Back to product
            </button>
          </div>

          <div className="my-6 flex items-center gap-3 rounded-lg border border-border bg-surface p-3">
            <div className="h-14 w-14 overflow-hidden rounded-md border border-border bg-surface-sunken">
              {cutoutUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cutoutUrl} alt="Product" className="h-full w-full object-contain" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{file?.name}</p>
              <p className="eyebrow">{category} · Background removed</p>
            </div>
          </div>

          <ModelPicker models={models} selectedId={modelId} onSelect={setModelId} />

          <p className="mt-6 text-xs text-muted">
            Our models are AI generated. Your product stays at the heart of every image. Fit
            and fine details should always be checked before publishing.
          </p>

          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm text-foreground">
              {selectedModel
                ? `${selectedModel.name} is your muse.`
                : "Select a model to continue."}
            </p>
            <button
              type="button"
              disabled={!modelId}
              onClick={() => setStep(3)}
              className="rounded-md bg-rust px-4 py-2.5 text-sm font-medium text-[#faf6ec] transition hover:bg-rust-dark disabled:opacity-40"
            >
              Continue with {selectedModel?.name ?? "model"} →
            </button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="mx-auto max-w-lg text-center">
          <h1 className="font-serif text-2xl text-foreground">Create your imagery.</h1>
          <p className="mt-1 text-sm text-muted">
            One last look before we bring your piece to life.
          </p>

          <div className="mt-8 flex items-center justify-center gap-6 rounded-lg border border-border bg-surface p-6">
            <div className="text-center">
              <div className="h-32 w-28 overflow-hidden rounded-md border border-border bg-surface-sunken">
                {cutoutUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cutoutUrl} alt="Product" className="h-full w-full object-contain" />
                )}
              </div>
              <p className="eyebrow mt-2">Your piece</p>
            </div>
            <span className="text-2xl text-muted">+</span>
            <div className="text-center">
              <div className="h-32 w-28 overflow-hidden rounded-md border border-border bg-surface-sunken">
                {selectedModel?.base_image_urls.front && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selectedModel.base_image_urls.front}
                    alt={selectedModel.name}
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <p className="eyebrow mt-2">{selectedModel?.name}</p>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="rounded-md border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:border-silver"
            >
              ← Change model
            </button>
            <button
              type="button"
              disabled={creating}
              onClick={handleCreate}
              className="rounded-md bg-rust px-5 py-2.5 text-sm font-medium text-[#faf6ec] transition hover:bg-rust-dark disabled:opacity-60"
            >
              {creating ? "Starting…" : "Create imagery"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
