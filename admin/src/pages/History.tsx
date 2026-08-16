import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { ProjectSelect } from "../components/ProjectSelect";
import {
  getCnttRequestsList,
  getProjects,
  getRequestsList,
  type ProjectItem,
  type RequestItem,
} from "../api";
import { getSummaryType } from "../auth";

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

function statusColor(s: string) {
  const map: Record<string, string> = {
    completed: "bg-brand-accent/20 text-brand-navy",
    processing: "bg-amber-100 text-amber-800",
    pending: "bg-brand-surface text-brand-navy",
    error: "bg-red-100 text-red-800",
    failed: "bg-red-100 text-red-800",
  };
  return map[s] ?? "bg-brand-surface text-brand-navy";
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
    <div>
      <PageHeader
        title="사용 내역"
        subtitle="요청·작업 내역을 조회하고 상세 정보로 이동할 수 있습니다."
        actions={
          projects.length > 0 ? (
            <ProjectSelect
              value={selectedProject}
              onChange={handleProjectChange}
              projects={projects}
              placeholder="전체 프로젝트"
              className="shrink-0"
            />
          ) : null
        }
      />

      <div className="admin-toolbar">
        <h3 className="admin-section-title mb-4">검색 및 필터</h3>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-full border border-brand-line/90 bg-brand-surface p-0.5 shadow-[inset_0_1px_2px_rgba(10,36,101,0.06)]">
            {(
              [
                { value: "", label: "전체" },
                { value: "completed", label: "완료" },
                { value: errorStatusValue, label: "오류" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value || "all"}
                type="button"
                onClick={() => {
                  setStatusFilter(opt.value);
                  setPage(1);
                }}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                  statusFilter === opt.value
                    ? "bg-white text-brand-navy shadow-sm ring-1 ring-black/[0.06]"
                    : "text-brand-slate hover:text-brand-navy"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder={isCntt ? "의도 검색" : "제목 검색"}
            className="admin-input flex-1 min-w-[200px]"
          />
          <button
            type="button"
            onClick={handleSearch}
            className="admin-btn-secondary"
          >
            검색
          </button>
          {(searchQuery || statusFilter) && (
            <span className="text-xs text-brand-slate">
              {searchQuery ? `"${searchQuery}" ` : ""}
              {statusFilter === "completed"
                ? "완료만"
                : statusFilter
                ? "오류만"
                : ""}
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="admin-card p-8 text-brand-slate">불러오는 중...</div>
      ) : error ? (
        <div className="admin-card p-8 text-red-600">{error}</div>
      ) : (
        <>
          <div className="admin-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-brand-surface text-left text-brand-slate">
                    <th className="px-5 py-3 font-medium">요청 시각</th>
                    <th className="px-5 py-3 font-medium">상태</th>
                    <th className="px-5 py-3 font-medium">처리 시간</th>
                    {showBrandColumn && (
                      <th className="px-5 py-3 font-medium">브랜드</th>
                    )}
                    <th className="px-5 py-3 font-medium">
                      {isCntt ? "요청 의도" : "제목"}
                    </th>
                    <th className="px-5 py-3 font-medium w-24"> </th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td
                        colSpan={showBrandColumn ? 6 : 5}
                        className="px-5 py-8 text-center text-brand-slate"
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
                      return (
                        <tr
                          key={r.job_id}
                          className="border-t border-brand-line/70 hover:bg-brand-surface/80"
                        >
                          <td className="px-5 py-3 text-brand-navy">
                            {formatDate(r.created_at)}
                          </td>
                          <td className="px-5 py-3">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${statusColor(
                                r.status
                              )}`}
                            >
                              {statusLabel(r.status)}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-brand-navy">
                            {r.processing_sec != null
                              ? `${r.processing_sec}초`
                              : "-"}
                          </td>
                          {showBrandColumn && (
                            <td className="px-5 py-3 text-brand-navy">
                              {brandName}
                            </td>
                          )}
                          <td
                            className="px-5 py-3 text-brand-navy max-w-[240px] truncate"
                            title={displayText !== "-" ? displayText : undefined}
                          >
                            {displayText}
                          </td>
                          <td className="px-5 py-3">
                            <button
                              type="button"
                              onClick={() => navigate(`/history/${r.job_id}`)}
                              className="px-3 py-1.5 rounded-lg text-sm font-medium text-brand-navy bg-brand-surface hover:bg-brand-line/50"
                            >
                              상세
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="px-5 py-3 border-t border-brand-line/70 flex items-center justify-between">
                <span className="text-sm text-brand-slate">
                  전체 {total}건 ({(page - 1) * PAGE_SIZE + 1}–
                  {Math.min(page * PAGE_SIZE, total)})
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium text-brand-navy bg-brand-surface hover:bg-brand-line/50 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    이전
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium text-brand-navy bg-brand-surface hover:bg-brand-line/50 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    다음
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
