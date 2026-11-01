import { supabase } from "./supabase";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export type ModelLibraryEntry = {
  id: number;
  name: string;
  base_image_urls: Record<string, string>;
  active: boolean;
};

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
  modelId: number
): Promise<{ job_id: number }> {
  const res = await fetch(`${API_URL}/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify({ product_id: productId, model_id: modelId }),
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
