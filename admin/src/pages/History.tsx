import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { ProjectSelect } from "../components/ProjectSelect";
import { ServerStatusBadge } from "../components/ServerStatusBadge";
import {
  getCnttRequestsList,
  getHealthCheck,
  getProjects,
  getRequestsList,
  type HealthStatus,
  type ProjectItem,
  type RequestItem,
} from "../api";
import { getSummaryType } from "../auth";
import iconChevronDown from "../assets/dashboard/icon2.svg";
import iconDivider from "../assets/dashboard/line2.svg";
import iconSearch from "../assets/dashboard/history-search.svg";
import iconDetail from "../assets/dashboard/history-chevron.svg";
import iconGood from "../assets/dashboard/history-badge-good.svg";
import iconMedium from "../assets/dashboard/history-badge-medium.svg";
import iconPoor from "../assets/dashboard/history-badge-poor.svg";
import iconErrorBadge from "../assets/dashboard/history-badge-error.svg";

const PAGE_SIZE = 20;

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("ko-KR", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function statusLabel(s: string) {
  const map: Record<string, string> = {
    completed: "완료",
    processing: "처리 중",
    pending: "대기",
    error: "오류",
    failed: "오류",
  };
  return map[s] ?? s;
}

/**
 * Figma 뱃지 톤 매핑 — Figma 원본은 STT 품질 등급(우수/보통/미흡/오류) 배지였지만,
 * 이 목록은 요청 처리 상태(완료/처리 중/대기/오류) 데이터라 라벨은 그대로 두고
 * 색·아이콘 스타일만 가장 가까운 톤으로 옮김: 완료→teal, 처리 중/대기→yellow, 오류→red.
 */
function statusBadgeStyle(s: string): { bg: string; text: string; icon: string } {
  const map: Record<string, { bg: string; text: string; icon: string }> = {
    completed: { bg: "bg-[rgba(64,224,208,0.2)]", text: "text-black", icon: iconGood },
    processing: { bg: "bg-[#fdf3df]", text: "text-[#d98f16]", icon: iconMedium },
    pending: { bg: "bg-[#fdf3df]", text: "text-[#d98f16]", icon: iconMedium },
    error: { bg: "bg-[#fbe6e6]", text: "text-[#f13e3e]", icon: iconPoor },
    failed: { bg: "bg-[#fbe6e6]", text: "text-[#f13e3e]", icon: iconPoor },
  };
  return (
    map[s] ?? { bg: "bg-[#f1e8ff]", text: "text-[#6600ff]", icon: iconErrorBadge }
  );
}

/** Figma "프로젝트 | 전체 ⌄" 스타일의 단순 필터 드롭다운 (상태 필터 전용) */
function FlatFilter<T extends string>({
  label,
  value,
  valueLabel,
  options,
  onChange,
}: {
  label: string;
  value: T;
  valueLabel: string;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex h-[34px] shrink-0 items-center gap-2 rounded-lg border border-[#d4d8e8] bg-white px-3 py-1.5">
      <span className="whitespace-nowrap text-[12px] leading-4 text-[#39435a]">
        {label}
      </span>
      <img src={iconDivider} alt="" className="h-3 w-px" />
      <span className="relative whitespace-nowrap text-[12px] font-medium leading-4 text-black">
        {valueLabel}
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as T)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label={label}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </span>
      <img src={iconChevronDown} alt="" className="h-5 w-5" />
    </div>
  );
}

export function History() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const projectFromUrl = searchParams.get("project_id") ?? "";
  const summaryType = getSummaryType();
  const isCntt = summaryType === "cntt";

  const [items, setItems] = useState<RequestItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [selectedProject, setSelectedProject] = useState(projectFromUrl);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [healthRefreshing, setHealthRefreshing] = useState(false);

  // project id → name lookup (used for CNTT brand column)
  const projectMap: Record<string, string> = {};
  for (const p of projects) {
    projectMap[String(p.id)] = p.name;
  }

  // hippo has a single project; CNTT has multiple
  const showBrandColumn = isCntt && projects.length > 1;

  useEffect(() => {
    getProjects()
      .then((res) => setProjects(res.items ?? []))
      .catch(() => setProjects([]));
  }, []);

  useEffect(() => {
    setSelectedProject(projectFromUrl);
  }, [projectFromUrl]);

  const refreshHealth = () => {
    setHealthRefreshing(true);
    setHealth(null);
    getHealthCheck()
      .then((h) => setHealth(h))
      .catch(() =>
        setHealth({ ok: false, status: "error", message: "연결 실패" })
      )
      .finally(() => setHealthRefreshing(false));
  };

  useEffect(() => {
    let cancelled = false;
    const runCheck = () =>
      getHealthCheck()
        .then((h) => {
          if (!cancelled) setHealth(h);
        })
        .catch(() => {
          if (!cancelled)
            setHealth({ ok: false, status: "error", message: "연결 실패" });
        });
    runCheck();
    const interval = setInterval(runCheck, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const handleProjectChange = (value: string) => {
    setSelectedProject(value);
    setPage(1);
    const next = new URLSearchParams(searchParams);
    if (value) next.set("project_id", value);
    else next.delete("project_id");
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const fetch = isCntt
      ? getCnttRequestsList(
          page,
          PAGE_SIZE,
          searchQuery || undefined,
          statusFilter || undefined,
          selectedProject || undefined
        )
      : getRequestsList(
          page,
          PAGE_SIZE,
          searchQuery || undefined,
          statusFilter || undefined,
          selectedProject || undefined
        );
    fetch
      .then(({ items: list, total: t }) => {
        if (!cancelled) {
          setItems(list);
          setTotal(t);
        }
      })
      .catch((e) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "목록 조회 실패");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, searchQuery, statusFilter, selectedProject, isCntt]);

  const handleSearch = () => {
    setSearchQuery(searchInput.trim());
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // CNTT uses "failed" for error status, hippo uses "error"
  const errorStatusValue = isCntt ? "failed" : "error";

  return (
    <div className="pb-4">
      <PageHeader
        variant="flat"
        title="사용 내역"
        subtitle="요청∙작업 내역을 조회하고 상세 정보를 확인해 보세요."
        actions={
          <ServerStatusBadge
            health={health}
            healthRefreshing={healthRefreshing}
            onRefresh={refreshHealth}
          />
        }
      />

      <div className="-mx-4 h-2 bg-[#f5f6f9] sm:-mx-6 lg:-mx-8" />

      <div className="flex flex-col gap-6 py-7">
        <div className="flex flex-wrap items-center gap-4">
          {projects.length > 0 && (
            <ProjectSelect
              value={selectedProject}
              onChange={handleProjectChange}
              projects={projects}
              placeholder="전체 프로젝트"
              variant="flat"
            />
          )}
          <FlatFilter
            label="상태"
            value={statusFilter}
            valueLabel={
              statusFilter === ""
                ? "전체"
                : statusFilter === "completed"
                  ? "완료"
                  : "오류"
            }
            options={[
              { value: "", label: "전체" },
              { value: "completed", label: "완료" },
              { value: errorStatusValue, label: "오류" },
            ]}
            onChange={(v) => {
              setStatusFilter(v);
              setPage(1);
            }}
          />
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-[#d4d8e8] bg-white px-3 py-2">
            <button
              type="button"
              onClick={handleSearch}
              className="flex h-4 w-4 shrink-0 items-center justify-center"
              aria-label="검색"
            >
              <img src={iconSearch} alt="" className="h-4 w-4" />
            </button>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder={isCntt ? "의도 검색..." : "제목 검색..."}
              className="min-w-0 flex-1 bg-transparent text-[12px] leading-4 text-black outline-none placeholder:text-[#6b7588]"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-[#56607a]">불러오는 중...</div>
        ) : error ? (
          <div className="p-8 text-red-600">{error}</div>
        ) : (
          <>
            <div className="overflow-hidden rounded-[12px] border border-[#e5e7e9]">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="h-12 border-b border-[#e5e7e9] bg-[#fbfcff] text-left text-[16px] tracking-[-0.02em] text-[#56607a]">
                      <th className="px-4 py-2 font-normal">
                        {isCntt ? "요청 의도" : "제목"}
                      </th>
                      {showBrandColumn && (
                        <th className="w-[120px] px-4 py-2 font-normal">
                          브랜드
                        </th>
                      )}
                      <th className="w-[120px] px-4 py-2 font-normal">상태</th>
                      <th className="w-[120px] px-4 py-2 font-normal">
                        처리 시간
                      </th>
                      <th className="px-4 py-2 font-normal">요청 시각</th>
                      <th className="w-[106px] px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td
                          colSpan={showBrandColumn ? 6 : 5}
                          className="px-4 py-8 text-center text-[#56607a]"
                        >
                          요청 내역 없음
                        </td>
                      </tr>
                    ) : (
                      items.map((r) => {
                        const displayText = isCntt
                          ? (r.intent ?? r.title ?? "-")
                          : (r.title ?? "-");
                        const brandName = showBrandColumn
                          ? (projectMap[String(r.project_id)] ?? "-")
                          : null;
                        const badge = statusBadgeStyle(r.status);
                        return (
                          <tr
                            key={r.job_id}
                            className="h-12 border-b border-[#e5e7e9] text-[16px] tracking-[-0.02em] text-black last:border-b-0 hover:bg-[#fbfcff]"
                          >
                            <td className="max-w-[320px] px-4 py-2 font-semibold">
                              <button
                                type="button"
                                onClick={() => navigate(`/history/${r.job_id}`)}
                                className="block max-w-full truncate text-left hover:underline"
                                title={displayText !== "-" ? displayText : undefined}
                              >
                                {displayText}
                              </button>
                            </td>
                            {showBrandColumn && (
                              <td className="px-4 py-2">{brandName}</td>
                            )}
                            <td className="px-4 py-2">
                              <span
                                className={`inline-flex items-center gap-1 rounded-lg py-0.5 pl-1 pr-2 ${badge.bg} ${badge.text}`}
                              >
                                <img src={badge.icon} alt="" className="h-5 w-5" />
                                {statusLabel(r.status)}
                              </span>
                            </td>
                            <td className="px-4 py-2">
                              {r.processing_sec != null
                                ? `${r.processing_sec}초`
                                : "-"}
                            </td>
                            <td className="px-4 py-2">
                              {formatDate(r.created_at)}
                            </td>
                            <td className="px-4 py-2">
                              <button
                                type="button"
                                onClick={() => navigate(`/history/${r.job_id}`)}
                                className="inline-flex items-center gap-1 whitespace-nowrap rounded text-[16px] tracking-[-0.02em] hover:underline"
                              >
                                자세히 보기
                                <img src={iconDetail} alt="" className="h-5 w-5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#56607a]">
                  전체 {total}건 ({(page - 1) * PAGE_SIZE + 1}–
                  {Math.min(page * PAGE_SIZE, total)})
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="rounded-lg bg-[#f5f6f9] px-3 py-1.5 text-sm font-medium text-black hover:bg-[#eaecf3] disabled:pointer-events-none disabled:opacity-50"
                  >
                    이전
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="rounded-lg bg-[#f5f6f9] px-3 py-1.5 text-sm font-medium text-black hover:bg-[#eaecf3] disabled:pointer-events-none disabled:opacity-50"
                  >
                    다음
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
