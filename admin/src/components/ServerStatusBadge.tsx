import type { HealthStatus } from "../api";
import iconRefresh from "../assets/dashboard/icon1.svg";

/** Figma 헤더의 "API 서버 상태: 정상" 표시 + 새로고침 버튼 (Dashboard/History 공용) */
export function ServerStatusBadge({
  health,
  healthRefreshing,
  onRefresh,
}: {
  health: HealthStatus | null;
  healthRefreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <>
      <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[12px] font-medium leading-4 text-[#39435a]">
        <span className="relative flex h-2 w-2 shrink-0">
          {health?.ok && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-accent opacity-60" />
          )}
          <span
            className={`relative inline-flex h-2 w-2 rounded-full ${
              health?.ok
                ? "bg-brand-accentDark"
                : health
                  ? "bg-red-500"
                  : "bg-[#97a0b8] animate-pulse"
            }`}
          />
        </span>
        {health === null && !healthRefreshing
          ? "API 서버 상태: 확인 중"
          : healthRefreshing
            ? "API 서버 상태: 확인 중"
            : health?.ok
              ? "API 서버 상태: 정상"
              : `API 서버 상태: ${health?.message ?? "연결 실패"}`}
      </span>
      <button
        type="button"
        onClick={onRefresh}
        disabled={healthRefreshing}
        title="다시 확인"
        className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg border border-[#d4d8e8] bg-white disabled:opacity-50"
      >
        <img
          src={iconRefresh}
          alt="새로고침"
          className={`h-5 w-5 ${healthRefreshing ? "animate-spin" : ""}`}
        />
      </button>
    </>
  );
}
