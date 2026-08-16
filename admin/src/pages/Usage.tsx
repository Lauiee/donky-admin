import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { ProjectSelect } from "../components/ProjectSelect";
import {
  getProjects,
  getUsage,
  type ProjectItem,
  type UsageStats,
} from "../api";
import { calcUsageCost, formatWon } from "../billing";

function formatDateForInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function defaultFrom(): string {
  const d = new Date();
  d.setDate(d.getDate() - 6);
  return formatDateForInput(d);
}
function defaultTo(): string {
  return formatDateForInput(new Date());
}

export function Usage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const projectFromUrl = searchParams.get("project_id") ?? "";
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [selectedProject, setSelectedProject] = useState(projectFromUrl);

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
    const next = new URLSearchParams(searchParams);
    if (value) next.set("project_id", value);
    else next.delete("project_id");
    setSearchParams(next, { replace: true });
  };

  const fetchUsage = useCallback(
    (fromDate: string, toDate: string, project?: string) => {
      setLoading(true);
      setError(null);
      getUsage(fromDate, toDate, project)
        .then(setStats)
        .catch((e) => setError(e instanceof Error ? e.message : "조회 실패"))
        .finally(() => setLoading(false));
    },
    []
  );

  // 최초 마운트 및 프로젝트 변경 시 조회
  useEffect(() => {
    fetchUsage(from, to, selectedProject || undefined);
  }, [selectedProject]); // eslint-disable-line react-hooks/exhaustive-deps -- from, to는 handleQuery로

  const handleQuery = () => {
    if (from && to) fetchUsage(from, to, selectedProject || undefined);
  };

  const dailyCounts = stats?.daily_counts ?? [];

  return (
    <div>
      <PageHeader
        title="사용량"
        subtitle="기간을 선택해 일별 사용량과 예상 비용을 확인하세요."
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
        <h3 className="admin-section-title mb-4">기간 조회</h3>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-brand-slate mb-1">
              시작일
            </label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="px-3 py-2 rounded-lg border border-brand-line text-sm text-brand-ink focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-brand-slate mb-1">
              종료일
            </label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="px-3 py-2 rounded-lg border border-brand-line text-sm text-brand-ink focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent"
            />
          </div>
          <button
            type="button"
            onClick={handleQuery}
            disabled={loading}
            className="admin-btn-primary shrink-0"
          >
            {loading ? "조회 중…" : "조회"}
          </button>
        </div>
        <p className="text-xs text-brand-mint mt-2">
          최대 90일까지 조회 가능합니다.
        </p>
      </div>

      {error && <div className="admin-card p-5 mb-8 text-red-600">{error}</div>}

      {!error && stats && (
        <>
          {/* 선택 기간 요약 */}
          <div className="admin-card p-5 sm:p-6 mb-8">
            <h3 className="admin-section-title mb-4">선택 기간 요약</h3>
            <div className="flex flex-wrap gap-6 text-sm mb-4">
              <span className="text-brand-slate">
                총 요청{" "}
                <strong className="text-brand-ink">{stats.total_count}</strong>
                건
              </span>
              <span className="text-brand-slate">
                완료{" "}
                <strong className="text-brand-ink">
                  {stats.completed_count}
                </strong>
                건
              </span>
              <span className="text-brand-slate">
                오류{" "}
                <strong className="text-brand-ink">{stats.error_count}</strong>
                건
              </span>
              {stats.avg_processing_sec != null && (
                <span className="text-brand-slate">
                  평균 처리{" "}
                  <strong className="text-brand-ink">
                    {stats.avg_processing_sec}초
                  </strong>
                </span>
              )}
            </div>
            {stats.total_count > 0 &&
              (() => {
                const usageCost = calcUsageCost(stats.total_count);
                const hasNegotiation =
                  stats.total_count >= 250_001 || usageCost < 0;
                return (
                  <div className="pt-4 border-t border-brand-line/70">
                    <p className="text-sm text-brand-slate">
                      이 기간 사용량 기준 예상 API 사용료:{" "}
                      {hasNegotiation ? (
                        <span className="text-amber-600 font-medium">
                          250,001건 이상으로 협의 필요
                        </span>
                      ) : (
                        <strong className="text-brand-navy">
                          {formatWon(usageCost)}
                        </strong>
                      )}
                      <span className="text-brand-mint ml-1.5 text-xs">
                        (참고 · 실제 청구는 당월 누적 기준)
                      </span>
                    </p>
                  </div>
                );
              })()}
          </div>

          {/* 일별 사용량 */}
          <div className="admin-card overflow-hidden">
            <h3 className="font-medium text-brand-ink mb-3 px-5 pt-5">
              일별 사용량
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-brand-surface text-left text-brand-slate">
                    <th className="px-5 py-3 font-medium">날짜</th>
                    <th className="px-5 py-3 font-medium">요청 건수</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyCounts.length === 0 ? (
                    <tr>
                      <td
                        colSpan={2}
                        className="px-5 py-8 text-center text-brand-slate"
                      >
                        데이터 없음
                      </td>
                    </tr>
                  ) : (
                    [...dailyCounts].reverse().map((d) => (
                      <tr
                        key={d.date}
                        className="border-t border-brand-line/70 hover:bg-brand-surface/80"
                      >
                        <td className="px-5 py-3 text-brand-navy">{d.date}</td>
                        <td className="px-5 py-3 font-medium text-brand-ink">
                          {d.count}건
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {loading && !stats && (
        <div className="admin-card p-8 text-brand-slate">불러오는 중...</div>
      )}
    </div>
  );
}
