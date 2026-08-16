const TOKEN_KEY = "donkey_admin_token";
const ROLE_KEY = "donkey_admin_role";
const TURING_DOMAIN_KEY = "donkey_admin_turing_domain";
const SUMMARY_TYPE_KEY = "donkey_admin_summary_type";

export type UserRole = "client" | "admin";

export type SummaryType = "soap" | "cntt" | "mixed";

export function getSummaryType(): SummaryType | null {
  const v = localStorage.getItem(SUMMARY_TYPE_KEY);
  if (v === "soap" || v === "cntt" || v === "mixed") return v;
  return null;
}

export function setSummaryType(t: SummaryType): void {
  localStorage.setItem(SUMMARY_TYPE_KEY, t);
}

export function clearSummaryType(): void {
  localStorage.removeItem(SUMMARY_TYPE_KEY);
}

/** Turing 채점 도메인 — 라벨/설명 세트 식별자. */
export type TuringDomain = "cnt" | "hippo";

export function getTuringDomain(): TuringDomain {
  const v = localStorage.getItem(TURING_DOMAIN_KEY);
  return v === "hippo" ? "hippo" : "cnt";
}

export function setTuringDomain(domain: TuringDomain): void {
  localStorage.setItem(TURING_DOMAIN_KEY, domain);
}

export function clearTuringDomain(): void {
  localStorage.removeItem(TURING_DOMAIN_KEY);
}

/**
 * 로그인한 사용자 정보에서 turing 도메인 결정.
 * 매핑 룰 placeholder — 실제 룰(백엔드 me 응답 어느 필드 보는지) 확정 시 이 함수만 수정.
 * 현재 휴리스틱: user_id에 'hippo' 포함 → hippo, 그 외 → cnt.
 */
export function deriveTuringDomainFromUser(me: {
  user_id: string;
  display_name?: string | null;
}): TuringDomain {
  const hint = `${me.user_id} ${me.display_name ?? ""}`.toLowerCase();
  if (hint.includes("hippo") || hint.includes("medic")) return "hippo";
  return "cnt";
}

export function getRole(): UserRole | null {
  const r = localStorage.getItem(ROLE_KEY);
  if (r === "client" || r === "admin") return r;
  if (isDevAuthBypass()) return devPreviewRole();
  return null;
}

export function setRole(role: UserRole): void {
  localStorage.setItem(ROLE_KEY, role);
}

export function clearRole(): void {
  localStorage.removeItem(ROLE_KEY);
}

/** JWT payload에서 exp(초 단위)를 읽어 만료 시각(ms) 반환. 실패 시 null */
export function getTokenExpiresAtMs(token: string): number | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(base64);
    const data = JSON.parse(json) as { exp?: number };
    if (typeof data.exp !== "number") return null;
    return data.exp * 1000;
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  clearRole();
  clearTuringDomain();
  clearSummaryType();
}

/** 로컬에서 레이아웃만 볼 때 (백엔드·로그인 없이). 프로덕션 빌드에서는 무시됨. */
export function isDevAuthBypass(): boolean {
  return (
    import.meta.env.DEV && import.meta.env.VITE_DEV_PREVIEW === "true"
  );
}

function devPreviewRole(): UserRole {
  return import.meta.env.VITE_DEV_PREVIEW_ROLE === "admin"
    ? "admin"
    : "client";
}

export function isLoggedIn(): boolean {
  if (isDevAuthBypass()) return true;
  return !!getToken();
}
