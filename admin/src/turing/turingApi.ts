/**
 * STT 채점(Turing) API — Base URL·X-API-Key
 * @see 프로젝트 외부 명세 API_Spec.md
 *
 * 로그인 계정의 도메인(cnt/hippo)에 따라 다른 백엔드를 호출한다 — getTuringBaseUrl/getTuringApiKey 참고.
 */

import { getTuringDomain } from "../auth";

async function turingFetch(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    throw new Error("서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.");
  }
}

export interface SttMetricsApi {
  /** 로그 기반 결정값 — 항상 산출 */
  stt_velocity: number;
  /** 아래 ratio 지표는 LLM-as-Judge 산출 실패/스킵 시 null */
  uer: number | null;
  pii_protection: number | null;
  mmr: number | null;
  mdr: number | null;
  diarization_accuracy: number | null;
  redundancy_ratio: number | null;
}

export interface SummaryMetricsApi {
  summarization_velocity: number | null;
  hallucination_ratio: number | null;
  ssr: number | null;
  icr: number | null;
  mir: number | null;
  summary_mdr: number | null;
  ssa: number | null;
}

export interface MetricsApi {
  processing_velocity: number;
  stt: SttMetricsApi;
  summary: SummaryMetricsApi;
}

export interface EvaluationListItemApi {
  id: number;
  job_id: string;
  audio_filename: string | null;
  audio_duration: number | null;
  language: string;
  specialty: string | null;
  created_at: string;
  metrics: MetricsApi;
}

export interface EvaluationsListResponse {
  total: number;
  page: number;
  size: number;
  items: EvaluationListItemApi[];
}

/** 지표별 상세 진단(JSON 그대로 저장) — 키별로 nullable object */
export type EvaluationDetailsApi = Record<string, unknown> | null;

/** GET /evaluations/{id} — 단건 전체 필드 (목록 항목 + 본문/참조/상세) */
export interface EvaluationFullApi extends EvaluationListItemApi {
  audio_url: string | null;
  segment_count: number | null;
  full_text: string | null;
  reference_text: string | null;
  has_reference: boolean;
  error_message: string | null;
  deleted_at: string | null;
  updated_at: string;
  details: EvaluationDetailsApi;
}

/**
 * Turing API base — 로그인한 계정의 도메인(cnt/hippo)에 따라 다른 백엔드.
 *   cnt   : VITE_TURING_API_BASE       (기본 dev 프록시 /turing-api       → 127.0.0.1:4314 / cntt.turing.intcorp.ai)
 *   hippo : VITE_TURING_API_BASE_HIPPO (기본 dev 프록시 /turing-api-hippo → 127.0.0.1:4313 / turing.donkey.ai.kr)
 */
function getTuringBaseUrl(): string {
  const domain = getTuringDomain();
  const envKey =
    domain === "hippo" ? "VITE_TURING_API_BASE_HIPPO" : "VITE_TURING_API_BASE";
  const env = (import.meta.env[envKey] as string | undefined)?.trim();
  if (env) return env.replace(/\/$/, "");
  if (import.meta.env.DEV) {
    return domain === "hippo" ? "/turing-api-hippo" : "/turing-api";
  }
  return "";
}

function buildTuringUrl(pathSuffix: string): URL {
  const base = getTuringBaseUrl();
  if (!base) {
    throw new Error(
      "Turing API Base가 없습니다. 개발에서는 Vite 프록시(/turing-api), 배포 시 VITE_TURING_API_BASE를 설정하세요."
    );
  }
  const path = `${base.replace(/\/$/, "")}${pathSuffix.startsWith("/") ? pathSuffix : `/${pathSuffix}`}`;
  return path.startsWith("http://") || path.startsWith("https://")
    ? new URL(path)
    : new URL(path, window.location.origin);
}

/** GET /health — 인증 불필요 */
export interface TuringHealthResponse {
  status: "ok" | "degraded";
  db: "connected" | "disconnected";
  last_write_at: string | null;
}

export async function fetchTuringHealth(): Promise<TuringHealthResponse> {
  const u = buildTuringUrl("/health");
  const res = await turingFetch(u.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      message?: string;
      error?: string;
    };
    throw new Error(
      body?.message || body?.error || `Health 요청 실패 (${res.status})`
    );
  }
  return res.json();
}

function getTuringApiKey(): string | undefined {
  const domain = getTuringDomain();
  const envKey =
    domain === "hippo" ? "VITE_TURING_API_KEY_HIPPO" : "VITE_TURING_API_KEY";
  return (import.meta.env[envKey] as string | undefined)?.trim();
}

function turingHeaders(): HeadersInit {
  const key = getTuringApiKey();
  const h: Record<string, string> = { Accept: "application/json" };
  if (key) h["X-API-Key"] = key;
  return h;
}

export function hasTuringApiKey(): boolean {
  return !!getTuringApiKey();
}

export async function fetchTuringEvaluations(params: {
  page?: number;
  size?: number;
  from?: string;
  to?: string;
  language?: string;
  specialty?: string;
  job_id?: string;
}): Promise<EvaluationsListResponse> {
  if (!hasTuringApiKey()) {
    throw new Error("VITE_TURING_API_KEY가 설정되지 않았습니다.");
  }

  const page = params.page ?? 1;
  const size = params.size ?? 10;
  const sp = new URLSearchParams();
  sp.set("page", String(page));
  sp.set("size", String(Math.min(100, Math.max(1, size))));
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  if (params.language) sp.set("language", params.language);
  if (params.specialty) sp.set("specialty", params.specialty);
  if (params.job_id) sp.set("job_id", params.job_id);

  const u = buildTuringUrl("/evaluations");
  sp.forEach((v, k) => u.searchParams.set(k, v));
  const res = await turingFetch(u.toString(), { headers: turingHeaders() });
  if (res.status === 401) {
    throw new Error("Turing API 인증에 실패했습니다. X-API-Key를 확인해 주세요.");
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      message?: string;
      error?: string;
    };
    throw new Error(
      body?.message || body?.error || `Turing API 오류 (${res.status})`
    );
  }
  return res.json();
}

/** GET /evaluations/{id} — 단건 전체 필드 조회 */
export async function fetchTuringEvaluationById(
  id: number
): Promise<EvaluationFullApi> {
  if (!Number.isInteger(id) || id < 1) {
    throw new Error("유효하지 않은 평가 ID입니다.");
  }
  if (!hasTuringApiKey()) {
    throw new Error("VITE_TURING_API_KEY가 설정되지 않았습니다.");
  }

  const u = buildTuringUrl(`/evaluations/${id}`);
  const res = await turingFetch(u.toString(), { headers: turingHeaders() });
  if (res.status === 401) {
    throw new Error("Turing API 인증에 실패했습니다. X-API-Key를 확인해 주세요.");
  }
  if (res.status === 404) {
    throw new Error("해당 평가 결과를 찾을 수 없습니다.");
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      message?: string;
      error?: string;
    };
    throw new Error(
      body?.message || body?.error || `Turing API 오류 (${res.status})`
    );
  }
  return res.json();
}
