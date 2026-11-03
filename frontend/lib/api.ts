import { supabase } from "./supabase";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export type PoseUrls = Record<string, string>;

// Either a flat single-look model ({pose: url}) or a model with multiple
// styled occasions ({occasion: {pose: url}}), e.g. bridal/festive/daily.
export type ModelLibraryEntry = {
  id: number;
  name: string;
  base_image_urls: Record<string, string | PoseUrls>;
  active: boolean;
};

export function modelOccasions(model: ModelLibraryEntry): string[] {
  const first = Object.values(model.base_image_urls)[0];
  if (typeof first !== "object" || first === null) return [];
  return Object.keys(model.base_image_urls);
}

export function modelPoseUrls(
  model: ModelLibraryEntry,
  occasion?: string | null
): PoseUrls {
  const occasions = modelOccasions(model);
  if (occasions.length === 0) return model.base_image_urls as PoseUrls;
  const key = occasion && occasions.includes(occasion) ? occasion : occasions[0];
  return (model.base_image_urls as Record<string, PoseUrls>)[key] ?? {};
}

export type JobStatus = {
  status: "pending" | "processing" | "complete" | "needs_review" | "failed";
  result_urls: Record<string, string> | null;
  placement_confidence: number | null;
  error: string | null;
};

export async function listModels(): Promise<ModelLibraryEntry[]> {
  const res = await fetch(`${API_URL}/models`);
  if (!res.ok) throw new Error("Failed to load models");
  return res.json();
}

export async function uploadProduct(
  file: File,
  category: "apparel" | "jewelry"
): Promise<{ product_id: number; cutout_image_url: string }> {
  const form = new FormData();
  form.append("file", file);
  form.append("category", category);

  const res = await fetch(`${API_URL}/products/upload`, {
    method: "POST",
    headers: await authHeaders(),
    body: form,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createJob(
  productId: number,
  modelId: number,
  occasion?: string | null
): Promise<{ job_id: number }> {
  const res = await fetch(`${API_URL}/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify({
      product_id: productId,
      model_id: modelId,
      occasion: occasion ?? null,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getJob(jobId: number): Promise<JobStatus> {
  const res = await fetch(`${API_URL}/jobs/${jobId}`, {
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
