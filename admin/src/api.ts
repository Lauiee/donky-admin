import { getToken } from "./auth";

/**
 * API 베이스 URL.
 * - VITE_API_BASE가 있으면 개발/프로덕션 모두 해당 절대 URL (브라우저 직접 호출 → 원격이면 CORS 필요)
 * - 개발에서 비어 있으면 /api (Vite 프록시 — 대상은 vite.config 의 VITE_API_PROXY_TARGET, 기본 localhost:8000)
 * - 프로덕션에서 비어 있으면 상대 경로(같은 오리진)
 */
const rawBase =
  (import.meta.env.VITE_API_BASE as string | undefined)?.trim() ?? "";
const API_BASE = rawBase || (import.meta.env.DEV ? "/api" : "");

async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    throw new Error("서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.");
  }
}

function getHeaders(includeAuth = true): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (includeAuth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

export async function login(
  userId: string,
  password: string
): Promise<{ access_token: string }> {
  const res = await apiFetch(`${API_BASE}/admin/api/login`, {
    method: "POST",
    headers: getHeaders(false),
    body: JSON.stringify({ user_id: userId, password }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      message?: string;
      code?: string;
    };
    const msg = body?.message ?? `로그인 실패 (${res.status})`;
    if (res.status === 503) {
      throw new Error("관리자 로그인이 설정되지 않았습니다. (DB 연결 확인)");
    }
    throw new Error(msg);
  }
  return res.json();
}

export interface ProjectItem {
  id: string;
  name: string;
}

export async function getProjects(): Promise<{ items: ProjectItem[] }> {
  const res = await apiFetch(`${API_BASE}/admin/api/projects`, {
    headers: getHeaders(),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      detail?: string | { message?: string };
    };
    const msg =
      (typeof body?.detail === "string"
        ? body.detail
        : body?.detail?.message) || `프로젝트 목록 조회 실패 (${res.status})`;
    throw new Error(msg);
  }
  return res.json();
}

export async function getMe(): Promise<{
  user_id: string;
  display_name: string | null;
  role?: "client" | "admin";
  client_id?: number | null;
  summary_type?: "soap" | "cntt" | "mixed";
}> {
  const res = await apiFetch(`${API_BASE}/admin/api/me`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Unauthorized");
  return res.json();
}

export interface RatePeriod {
  total: number;
  completed: number;
  error: number;
}

export interface DashboardStats {
  today_count: number;
  week_count: number;
  month_count: number;
  year_count: number;
  rate: { week: RatePeriod; month: RatePeriod; year: RatePeriod };
  avg_processing_sec: number | null;
  daily_counts: { date: string; count: number }[];
  summary_eval?: {
    avg_hr: number | null;
    avg_ssr: number | null;
    avg_icr: number | null;
    eval_count: number;
  };
  summary_eval_trend?: {
    label: string;
    hr: number | null;
    ssr: number | null;
    icr: number | null;
  }[];
}

export interface UsageStats {
  daily_counts: { date: string; count: number }[];
  total_count: number;
  completed_count: number;
  error_count: number;
  avg_processing_sec: number | null;
}

export async function getUsage(
  fromDate: string,
  toDate: string,
  project?: string
): Promise<UsageStats> {
  const params = new URLSearchParams({ from_date: fromDate, to_date: toDate });
  if (project?.trim()) params.set("project_id", project.trim());
  const res = await apiFetch(`${API_BASE}/admin/api/usage?${params}`, {
    headers: getHeaders(),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      detail?: string | { message?: string };
    };
    const msg =
      (typeof body?.detail === "string"
        ? body.detail
        : body?.detail?.message) || `사용량 조회 실패 (${res.status})`;
    throw new Error(msg);
  }
  return res.json();
}

export interface RequestItem {
  job_id: string;
  created_at: string;
  status: string;
  processing_sec: number | null;
  title: string | null;
  intent?: string | null;
  project_id?: number | null;
}

export interface RequestDetail {
  job_id: string;
  created_at: string;
  status: string;
  request_type: string;
  file_url: string;
  stored_audio_url: string | null;
  client_name: string;
  request_timestamp: string | null;
  completed_at: string | null;
  processing_time_ms: number | null;
  processing_sec: number | null;
  audio_duration_sec: number | null;
  stages: Record<string, number> | null;
  quality: Record<string, unknown> | null;
  model_usage: Record<string, unknown> | null;
  error: Record<string, unknown> | null;
  title: string | null;
  simple_summary: string | null;
  doctor_notes?: string[] | null;
  test_results?: string[] | null;
  symptom_record?: string[] | null;
  prescription_and_care?: string[] | null;
  conversation_content: unknown[] | null;
  // CNTT-specific CIAR fields (top-level strings)
  context?: string | null;
  intent?: string | null;
  action?: string | null;
  result?: string | null;
  issue?: string | null;
  project_id?: number | null;
  summary_eval?: {
    simpleSummary_eval?: {
      summary_scores?: {
        supported_ratio?: number;
        hallucination_rate?: number;
        contradiction_rate?: number;
      };
      ssr?: number;
      icr?: number | null;
    } | null;
    consultation_aggregate?: {
      supported_ratio?: number;
      hallucination_rate?: number;
      contradiction_rate?: number;
      ssr?: number;
      icr?: number | null;
    };
  } | null;
}

export async function getRequestDetail(jobId: string): Promise<RequestDetail> {
  const res = await apiFetch(
    `${API_BASE}/admin/api/requests/${encodeURIComponent(jobId)}`,
    { headers: getHeaders() }
  );
  if (!res.ok) {
    if (res.status === 404) throw new Error("해당 요청을 찾을 수 없습니다.");
    const body = (await res.json().catch(() => ({}))) as {
      detail?: string | { message?: string };
    };
    const msg =
      (typeof body?.detail === "string"
        ? body.detail
        : body?.detail?.message) || `상세 조회 실패 (${res.status})`;
    throw new Error(msg);
  }
  return res.json();
}

export async function getCnttRequestDetail(jobId: string): Promise<RequestDetail> {
  const res = await apiFetch(
    `${API_BASE}/admin/cntt/requests/${encodeURIComponent(jobId)}`,
    { headers: getHeaders() }
  );
  if (!res.ok) {
    if (res.status === 404) throw new Error("해당 요청을 찾을 수 없습니다.");
    const body = (await res.json().catch(() => ({}))) as {
      detail?: string | { message?: string };
    };
    const msg =
      (typeof body?.detail === "string"
        ? body.detail
        : body?.detail?.message) || `상세 조회 실패 (${res.status})`;
    throw new Error(msg);
  }
  return res.json();
}

export async function getRequestsList(
  page = 1,
  limit = 50,
  title?: string,
  status?: string,
  project?: string
): Promise<{ items: RequestItem[]; total: number }> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (title?.trim()) params.set("title", title.trim());
  if (status?.trim()) params.set("status", status.trim());
  if (project?.trim()) params.set("project_id", project.trim());
  const res = await apiFetch(`${API_BASE}/admin/api/requests?${params}`, {
    headers: getHeaders(),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      detail?: string | { message?: string };
    };
    const msg =
      (typeof body?.detail === "string"
        ? body.detail
        : body?.detail?.message) || `목록 조회 실패 (${res.status})`;
    throw new Error(msg);
  }
  return res.json();
}

export async function getCnttRequestsList(
  page = 1,
  limit = 50,
  intent?: string,
  status?: string,
  project?: string
): Promise<{ items: RequestItem[]; total: number }> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (intent?.trim()) params.set("intent", intent.trim());
  if (status?.trim()) params.set("status", status.trim());
  if (project?.trim()) params.set("project_id", project.trim());
  const res = await apiFetch(`${API_BASE}/admin/cntt/requests?${params}`, {
    headers: getHeaders(),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      detail?: string | { message?: string };
    };
    const msg =
      (typeof body?.detail === "string"
        ? body.detail
        : body?.detail?.message) || `목록 조회 실패 (${res.status})`;
    throw new Error(msg);
  }
  return res.json();
}

export interface ErrorItem {
  job_id: string;
  created_at: string | null;
  error: {
    code?: string;
    type?: string;
    message?: string;
    stage?: string;
    detail?: string;
  };
}

export async function getErrors(
  period: "week" | "month" | "year",
  project?: string
): Promise<{ items: ErrorItem[] }> {
  const params = new URLSearchParams({ period });
  if (project?.trim()) params.set("project_id", project.trim());
  const res = await apiFetch(`${API_BASE}/admin/api/errors?${params}`, {
    headers: getHeaders(),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      detail?: string | { message?: string };
    };
    const msg =
      (typeof body?.detail === "string"
        ? body.detail
        : body?.detail?.message) || `오류 목록 조회 실패 (${res.status})`;
    throw new Error(msg);
  }
  return res.json();
}

export interface HealthStatus {
  ok: boolean;
  status?: string;
  message?: string;
}

/** 백엔드 API 서버 헬스체크 (인증 불필요) */
export async function getHealthCheck(): Promise<HealthStatus> {
  try {
    const res = await apiFetch(`${API_BASE}/health`, {
      headers: getHeaders(false),
    });
    if (!res.ok) {
      return {
        ok: false,
        status: "error",
        message: `HTTP ${res.status}`,
      };
    }
    const body = (await res.json().catch(() => ({}))) as {
      status?: string;
      [key: string]: unknown;
    };
    const status = body?.status ?? "ok";
    return {
      ok: true,
      status: status as string,
    };
  } catch (e) {
    return {
      ok: false,
      status: "error",
      message: e instanceof Error ? e.message : "연결 실패",
    };
  }
}

export async function getDashboard(project?: string): Promise<DashboardStats> {
  const params = project?.trim()
    ? `?project_id=${encodeURIComponent(project.trim())}`
    : "";
  const res = await apiFetch(`${API_BASE}/admin/api/dashboard${params}`, {
    headers: getHeaders(),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      detail?: string | { message?: string };
    };
    const msg =
      (typeof body?.detail === "string"
        ? body.detail
        : body?.detail?.message) || `대시보드 조회 실패 (${res.status})`;
    throw new Error(msg);
  }
  return res.json();
}

export interface InquiryItem {
  id: string;
  title: string;
  status: string;
  project_id?: string | null;
  created_at: string;
  updated_at: string | null;
  author: string | null;
}

export interface InquiryDetail {
  id: string;
  title: string;
  body: string;
  status: string;
  project_id?: string | null;
  project_name?: string | null;
  attachment_urls?: string[];
  created_at: string;
  updated_at: string | null;
  author: string | null;
  author_email: string | null;
  replies: {
    id: string;
    body: string;
    created_at: string;
    author: string | null;
  }[];
}

/** 첨부파일 업로드 - 반환된 url을 attachment_urls에 담아 문의 등록/수정 시 전달 */
export async function uploadInquiryAttachment(
  file: File
): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const token = getToken();
  const headers: HeadersInit = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await apiFetch(
    `${API_BASE}/admin/api/inquiries/attachments/upload`,
    {
      method: "POST",
      headers,
      body: formData,
    }
  );
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      detail?: string | { message?: string };
    };
    const msg =
      (typeof body?.detail === "string"
        ? body.detail
        : body?.detail?.message) || `파일 업로드 실패 (${res.status})`;
    throw new Error(msg);
  }
  return res.json();
}

export async function createInquiry(
  title: string,
  body: string,
  projectId?: string,
  attachmentUrls?: string[]
): Promise<{
  id: string;
  title: string;
  body: string;
  status: string;
  created_at: string;
  author: string | null;
}> {
  const body_: Record<string, unknown> = {
    title,
    body,
    attachment_urls: attachmentUrls ?? [],
  };
  if (projectId?.trim()) body_.project_id = projectId.trim();
  const res = await apiFetch(`${API_BASE}/admin/api/inquiries`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body_),
  });
  if (!res.ok) {
    const resBody = (await res.json().catch(() => ({}))) as {
      detail?: string | { message?: string };
    };
    const msg =
      (typeof resBody?.detail === "string"
        ? resBody.detail
        : resBody?.detail?.message) || `문의 등록 실패 (${res.status})`;
    throw new Error(msg);
  }
  return res.json();
}

export async function getInquiriesList(
  page = 1,
  limit = 20,
  status?: string,
  q?: string,
  projectId?: string
): Promise<{ items: InquiryItem[]; total: number }> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (status?.trim()) params.set("status", status.trim());
  if (q?.trim()) params.set("q", q.trim());
  if (projectId?.trim()) params.set("project_id", projectId.trim());
  const res = await apiFetch(`${API_BASE}/admin/api/inquiries?${params}`, {
    headers: getHeaders(),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      detail?: string | { message?: string };
    };
    const msg =
      (typeof body?.detail === "string"
        ? body.detail
        : body?.detail?.message) || `문의 목록 조회 실패 (${res.status})`;
    throw new Error(msg);
  }
  return res.json();
}

/** 문의 전체 조회 (role=admin 전용, 403 otherwise) */
export async function getInquiriesAll(
  page = 1,
  limit = 20,
  status?: string,
  q?: string,
  projectId?: string
): Promise<{ items: InquiryItem[]; total: number }> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(Math.min(limit, 500)),
  });
  if (status?.trim()) params.set("status", status.trim());
  if (q?.trim()) params.set("q", q.trim());
  if (projectId?.trim()) params.set("project_id", projectId.trim());
  const res = await apiFetch(`${API_BASE}/admin/api/inquiries/all?${params}`, {
    headers: getHeaders(),
  });
  if (!res.ok) {
    if (res.status === 403) throw new Error("권한이 없습니다.");
    const body = (await res.json().catch(() => ({}))) as {
      detail?: string | { message?: string };
    };
    const msg =
      (typeof body?.detail === "string"
        ? body.detail
        : body?.detail?.message) || `문의 전체 조회 실패 (${res.status})`;
    throw new Error(msg);
  }
  return res.json();
}

export async function getInquiryDetail(id: string): Promise<InquiryDetail> {
  const res = await apiFetch(
    `${API_BASE}/admin/api/inquiries/${encodeURIComponent(id)}`,
    { headers: getHeaders() }
  );
  if (!res.ok) {
    if (res.status === 404) throw new Error("해당 문의를 찾을 수 없습니다.");
    const body = (await res.json().catch(() => ({}))) as {
      detail?: string | { message?: string };
    };
    const msg =
      (typeof body?.detail === "string"
        ? body.detail
        : body?.detail?.message) || `문의 상세 조회 실패 (${res.status})`;
    throw new Error(msg);
  }
  return res.json();
}

export async function updateInquiry(
  id: string,
  data: { title: string; body: string; attachment_urls: string[] }
): Promise<InquiryDetail> {
  const res = await apiFetch(
    `${API_BASE}/admin/api/inquiries/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify(data),
    }
  );
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      detail?: string | { message?: string };
    };
    const msg =
      (typeof body?.detail === "string"
        ? body.detail
        : body?.detail?.message) || `수정 실패 (${res.status})`;
    throw new Error(msg);
  }
  return res.json();
}

export async function deleteInquiry(id: string): Promise<void> {
  const res = await apiFetch(
    `${API_BASE}/admin/api/inquiries/${encodeURIComponent(id)}`,
    { method: "DELETE", headers: getHeaders() }
  );
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      detail?: string | { message?: string };
    };
    const msg =
      (typeof body?.detail === "string"
        ? body.detail
        : body?.detail?.message) || `삭제 실패 (${res.status})`;
    throw new Error(msg);
  }
}

export async function updateInquiryStatus(
  id: string,
  status: string
): Promise<{ id: string; status: string; updated_at: string }> {
  const res = await apiFetch(
    `${API_BASE}/admin/api/inquiries/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify({ status }),
    }
  );
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      detail?: string | { message?: string };
    };
    const msg =
      (typeof body?.detail === "string"
        ? body.detail
        : body?.detail?.message) || `상태 변경 실패 (${res.status})`;
    throw new Error(msg);
  }
  return res.json();
}

export async function createInquiryReply(
  id: string,
  body: string
): Promise<{
  id: string;
  body: string;
  created_at: string;
  author: string | null;
}> {
  const res = await apiFetch(
    `${API_BASE}/admin/api/inquiries/${encodeURIComponent(id)}/replies`,
    {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ body }),
    }
  );
  if (!res.ok) {
    const resBody = (await res.json().catch(() => ({}))) as {
      detail?: string | { message?: string };
    };
    const msg =
      (typeof resBody?.detail === "string"
        ? resBody.detail
        : resBody?.detail?.message) || `답변 등록 실패 (${res.status})`;
    throw new Error(msg);
  }
  return res.json();
}

/** 답변 수정 (role=admin 전용) */
export async function updateInquiryReply(
  inquiryId: string,
  replyId: string,
  body: string
): Promise<{
  id: string;
  body: string;
  created_at: string;
  author: string | null;
}> {
  const res = await apiFetch(
    `${API_BASE}/admin/api/inquiries/${encodeURIComponent(
      inquiryId
    )}/replies/${encodeURIComponent(replyId)}`,
    {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify({ body }),
    }
  );
  if (!res.ok) {
    const resBody = (await res.json().catch(() => ({}))) as {
      detail?: string | { message?: string };
    };
    const msg =
      (typeof resBody?.detail === "string"
        ? resBody.detail
        : resBody?.detail?.message) || `답변 수정 실패 (${res.status})`;
    throw new Error(msg);
  }
  return res.json();
}

/** 답변 삭제 (role=admin 전용) */
export async function deleteInquiryReply(
  inquiryId: string,
  replyId: string
): Promise<void> {
  const res = await apiFetch(
    `${API_BASE}/admin/api/inquiries/${encodeURIComponent(
      inquiryId
    )}/replies/${encodeURIComponent(replyId)}`,
    { method: "DELETE", headers: getHeaders() }
  );
  if (!res.ok) {
    const resBody = (await res.json().catch(() => ({}))) as {
      detail?: string | { message?: string };
    };
    const msg =
      (typeof resBody?.detail === "string"
        ? resBody.detail
        : resBody?.detail?.message) || `답변 삭제 실패 (${res.status})`;
    throw new Error(msg);
  }
}

/** 세션 연장: 새 토큰(4시간) 발급 후 저장용 반환 */
export async function refreshSession(): Promise<{ access_token: string }> {
  const res = await apiFetch(`${API_BASE}/admin/api/refresh`, {
    method: "POST",
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("세션 연장에 실패했습니다.");
  return res.json();
}
