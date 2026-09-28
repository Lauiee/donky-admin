import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { DashboardLineChart } from "../components/DashboardLineChart";
import { PageHeader } from "../components/PageHeader";
import { ProjectSelect } from "../components/ProjectSelect";
import { SegmentedControl } from "../components/SegmentedControl";
import { StatCard } from "../components/StatCard";
import {
  getDashboard,
  getErrors,
  getHealthCheck,
  getProjects,
  type DashboardStats,
  type ErrorItem,
  type HealthStatus,
  type ProjectItem,
  type RatePeriod,
} from "../api";
import imgRequest from "../assets/dashboard/frame1171276861.png";
import imgSuccess from "../assets/dashboard/img2026062920412.png";
import imgError from "../assets/dashboard/img2026062920441.png";
import imgDuration from "../assets/dashboard/img2026062920501.png";
import imgVoiceTotal from "../assets/dashboard/frame1707480011.png";
import imgVoiceAvg from "../assets/dashboard/img2026062920413.png";
import imgRetry from "../assets/dashboard/img2026062920442.png";
import imgCost from "../assets/dashboard/img2026062920502.png";
import { ServerStatusBadge } from "../components/ServerStatusBadge";

/** Figma 이미지 fill의 배율/오프셋 그대로 재현하는 크롭 래퍼 */
function CardImage({ src, style }: { src: string; style: CSSProperties }) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <img alt="" src={src} className="absolute max-w-none" style={style} />
    </div>
  );
}

type Period = "week" | "month" | "year";
const PERIOD_LABEL: Record<Period, string> = {
  week: "주",
  month: "월",
  year: "연",
};

type ReqPeriod = "day" | "week" | "month";
const REQ_PERIOD_LABEL: Record<ReqPeriod, string> = {
  day: "일",
  week: "주",
  month: "월",
};

const REQ_OPTIONS = (["day", "week", "month"] as const).map((p) => ({
  value: p,
  label: REQ_PERIOD_LABEL[p],
}));
const PERIOD_OPTIONS = (["week", "month", "year"] as const).map((p) => ({
  value: p,
  label: PERIOD_LABEL[p],
}));

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("week");
  const [errorPeriod, setErrorPeriod] = useState<Period>("week");
  const [reqPeriod, setReqPeriod] = useState<ReqPeriod>("day");
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorItems, setErrorItems] = useState<ErrorItem[] | null>(null);
  const [errorModalLoading, setErrorModalLoading] = useState(false);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [healthRefreshing, setHealthRefreshing] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const projectFromUrl = searchParams.get("project_id") ?? "";
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [selectedProject, setSelectedProject] =
    useState<string>(projectFromUrl);

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
    getProjects()
      .then((res) => {
        if (!cancelled) setProjects(res.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setProjects([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getDashboard(selectedProject || undefined)
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "조회 실패");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedProject]);

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

  const headerActions = (
    <>
      {projects.length > 0 && (
        <ProjectSelect
          value={selectedProject}
          onChange={handleProjectChange}
          projects={projects}
          placeholder="전체 프로젝트"
          variant="flat"
        />
      )}
      <ServerStatusBadge
        health={health}
        healthRefreshing={healthRefreshing}
        onRefresh={refreshHealth}
      />
    </>
  );

  if (loading) {
    return (
      <div>
        <PageHeader
          variant="flat"
          title="대시보드"
          subtitle="프로젝트별 API 사용 현황을 한눈에 확인해 보세요."
          actions={headerActions}
        />
        <div className="flex min-h-[200px] items-center justify-center p-12 text-[#56607a]">
          <div className="flex flex-col items-center gap-3">
            <span className="h-9 w-9 animate-spin rounded-full border-2 border-[#eaecf3] border-t-brand-accent" />
            <span className="text-sm font-medium">불러오는 중…</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div>
        <PageHeader
          variant="flat"
          title="대시보드"
          subtitle="프로젝트별 API 사용 현황을 한눈에 확인해 보세요."
          actions={headerActions}
        />
        <div className="admin-card border-l-4 border-l-red-400 p-8 text-red-700">
          {error ?? "데이터 없음"}
        </div>
      </div>
    );
  }

  const r: RatePeriod = stats.rate?.[period] ?? {
    total: 0,
    completed: 0,
    error: 0,
  };
  const rError: RatePeriod = stats.rate?.[errorPeriod] ?? {
    total: 0,
    completed: 0,
    error: 0,
  };
  const completedRate =
    r.total > 0 ? Math.round((r.completed / r.total) * 100) : 0;

  return (
    <div className="pb-4">
      <PageHeader
        variant="flat"
        title="대시보드"
        subtitle="프로젝트별 API 사용 현황을 한눈에 확인해 보세요."
        actions={headerActions}
      />

      {/* Figma 구분선 (섹션 사이 8px 회색 바) */}
      <div className="-mx-4 my-0 h-2 bg-[#f5f6f9] sm:-mx-6 lg:-mx-8" />

      <section className="flex flex-col gap-4 px-0 py-10">
        <div className="flex items-center justify-between">
          <h3 className="text-[20px] font-bold leading-6 tracking-[-0.02em] text-black">
            핵심 지표
          </h3>
          <ProjectSelect
            value={selectedProject}
            onChange={handleProjectChange}
            projects={projects}
            placeholder="전체 프로젝트"
            variant="flat"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <StatCard
            className="sm:flex-1"
            label="요청량"
            headerRight={
              <SegmentedControl
                options={REQ_OPTIONS}
                value={reqPeriod}
                onChange={setReqPeriod}
              />
            }
            value={
              reqPeriod === "day"
                ? stats.today_count
                : reqPeriod === "week"
                  ? stats.week_count
                  : (stats.month_count ?? 0)
            }
            unit="건"
            image={
              <CardImage
                src={imgRequest}
                style={{
                  height: "91.3%",
                  left: "-31.79%",
                  top: "4.35%",
                  width: "163.59%",
                }}
              />
            }
          />

          <StatCard
            className="sm:flex-1"
            label="성공률"
            headerRight={
              <SegmentedControl
                options={PERIOD_OPTIONS}
                value={period}
                onChange={setPeriod}
              />
            }
            value={completedRate}
            unit="%"
            image={
              <CardImage
                src={imgSuccess}
                style={{
                  height: "394.97%",
                  left: "-475%",
                  top: "-272.83%",
                  width: "707.66%",
                }}
              />
            }
          />

          <StatCard
            className="sm:flex-1"
            label="오류 발생"
            headerRight={
              <SegmentedControl
                options={PERIOD_OPTIONS}
                value={errorPeriod}
                onChange={setErrorPeriod}
                stopPropagation
              />
            }
            value={rError.error}
            unit="건"
            onClick={() => {
              setErrorModalOpen(true);
              setErrorModalLoading(true);
              setErrorItems(null);
              getErrors(errorPeriod, selectedProject || undefined)
                .then((res) => setErrorItems(res.items))
                .catch(() => setErrorItems([]))
                .finally(() => setErrorModalLoading(false));
            }}
            image={
              <CardImage
                src={imgError}
                style={{
                  height: "110.87%",
                  left: "-49.32%",
                  top: "-5.43%",
                  width: "198.64%",
                }}
              />
            }
          />

          <StatCard
            className="sm:flex-1"
            label="처리 시간 평균"
            value={
              stats.avg_processing_sec != null
                ? Number(stats.avg_processing_sec).toFixed(1)
                : "—"
            }
            unit={stats.avg_processing_sec != null ? "초" : undefined}
            image={
              <CardImage
                src={imgDuration}
                style={{
                  height: "118.42%",
                  left: "-56.09%",
                  top: "-9.21%",
                  width: "212.17%",
                }}
              />
            }
          />
        </div>

        {/*
          Figma 8개 지표 중 아래 4개 — 이 값을 채울 백엔드 필드가 아직 없어서
          (음성 길이, 재처리 횟수, 예상 비용 관련 API 응답 필드 없음) 디자인만 반영하고
          "—"로 비워둠. 백엔드 필드가 생기면 value={...} 부분만 연결하면 됨.
        */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <StatCard
            className="sm:flex-1"
            label="총 음성길이"
            value="—"
            image={
              <CardImage
                src={imgVoiceTotal}
                style={{
                  height: "44.74%",
                  left: "6.43%",
                  top: "27.63%",
                  width: "87.14%",
                }}
              />
            }
          />
          <StatCard
            className="sm:flex-1"
            label="평균 음성길이"
            value="—"
            image={
              <CardImage
                src={imgVoiceAvg}
                style={{
                  height: "50%",
                  left: "8.41%",
                  top: "25%",
                  width: "83.18%",
                }}
              />
            }
          />
          <StatCard
            className="sm:flex-1"
            label="재처리 요청량"
            value="—"
            image={
              <CardImage
                src={imgRetry}
                style={{
                  height: "100%",
                  left: "-39.66%",
                  top: "-0.31%",
                  width: "179.17%",
                }}
              />
            }
          />
          <StatCard
            className="sm:flex-1"
            label="예상 비용"
            value="—"
            image={
              <CardImage
                src={imgCost}
                style={{
                  height: "100%",
                  left: "-39.66%",
                  top: "-0.26%",
                  width: "179.17%",
                }}
              />
            }
          />
        </div>
      </section>

      <div className="-mx-4 h-2 bg-[#f5f6f9] sm:-mx-6 lg:-mx-8" />

      {(stats.daily_counts ?? []).length > 0 && (
        <section className="flex flex-col gap-4 px-0 py-10">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
            <h3 className="whitespace-nowrap text-[20px] font-bold leading-6 tracking-[-0.02em] text-black">
              최근 7일 요청량 추이
            </h3>
            <p className="text-[12px] leading-4 tracking-[-0.02em] text-[#56607a]">
              마우스를 올려 일별 건수/ 최대 대비 비율을 확인하세요
            </p>
          </div>
          <DashboardLineChart data={stats.daily_counts ?? []} />
        </section>
      )}

      {errorModalOpen && (
        <div
          className="admin-modal-backdrop"
          onClick={() => setErrorModalOpen(false)}
        >
          <div
            className="admin-card flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-brand-line bg-brand-surface/40 px-6 py-4">
              <h3 className="text-base font-semibold text-brand-ink">
                오류 목록 (최근 {PERIOD_LABEL[errorPeriod]})
              </h3>
              <button
                type="button"
                onClick={() => setErrorModalOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-brand-mint transition-colors hover:bg-white hover:text-brand-navy"
                aria-label="닫기"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {errorModalLoading ? (
                <p className="text-center text-sm text-brand-slate">
                  불러오는 중…
                </p>
              ) : errorItems && errorItems.length === 0 ? (
                <p className="text-center text-sm text-brand-slate">
                  오류가 없습니다.
                </p>
              ) : errorItems ? (
                <ul className="space-y-3">
                  {errorItems.map((item) => {
                    const msg =
                      (item.error?.message as string) ||
                      (item.error?.detail as string) ||
                      "오류 발생";
                    const stage = item.error?.stage as string | undefined;
                    return (
                      <li
                        key={item.job_id}
                        className="overflow-hidden rounded-xl border border-brand-line bg-white shadow-sm transition-shadow hover:shadow-md"
                      >
                        <Link
                          to={`/history/${item.job_id}`}
                          className="block p-4 hover:bg-brand-surface/80"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-brand-ink">
                                {msg}
                              </p>
                              {stage && (
                                <p className="mt-1 text-xs text-brand-slate">
                                  단계: {stage}
                                </p>
                              )}
                            </div>
                            <span className="shrink-0 text-xs text-brand-mint">
                              {item.created_at
                                ? new Date(item.created_at).toLocaleString(
                                    "ko-KR"
                                  )
                                : "-"}
                            </span>
                          </div>
                          <p className="mt-2 text-xs font-medium text-brand-navy">
                            {item.job_id} →
                          </p>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

