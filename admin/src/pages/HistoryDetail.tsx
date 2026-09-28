import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getCnttRequestDetail,
  getHealthCheck,
  getRequestDetail,
  type HealthStatus,
  type RequestDetail,
} from "../api";
import { getSummaryType } from "../auth";
import { PageHeader } from "../components/PageHeader";
import { ServerStatusBadge } from "../components/ServerStatusBadge";
import { AiMetricsPanel } from "../components/AiMetricsPanel";
import { buildAiMetricCards, type AiMetricCardData } from "../turing/aiMetricCards";
import { fetchTuringEvaluations, hasTuringApiKey } from "../turing/turingApi";
import iconBack from "../assets/dashboard/detail-back.svg";
import iconSummary from "../assets/dashboard/detail-summary-icon.svg";
import iconTranscript from "../assets/dashboard/detail-transcript-icon.svg";

/** "AI 성능 지표" 탭 — 이 job_id에 해당하는 Turing 평가 1건을 찾아 카드로 변환 */
function AiMetricsTab({ jobId }: { jobId: string }) {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "no-key" }
    | { status: "error"; message: string }
    | { status: "empty" }
    | { status: "ready"; cards: AiMetricCardData[] }
  >({ status: "loading" });

  useEffect(() => {
    if (!hasTuringApiKey()) {
      setState({ status: "no-key" });
      return;
    }
    let cancelled = false;
    setState({ status: "loading" });
    // 이 요청 건의 평가(값·등급용) + 최근 평가 20건(카드 추이선용, 계정 전체 기준 —
    // Turing API가 "프로젝트" 단위 필터를 지원하지 않음) 을 함께 조회.
    Promise.all([
      fetchTuringEvaluations({ job_id: jobId, page: 1, size: 1 }),
      fetchTuringEvaluations({ page: 1, size: 20 }).catch(() => null),
    ])
      .then(([res, trendRes]) => {
        if (cancelled) return;
        const item = res.items?.[0];
        if (!item) {
          setState({ status: "empty" });
          return;
        }
        setState({
          status: "ready",
          cards: buildAiMetricCards(item.metrics, trendRes?.items ?? undefined),
        });
      })
      .catch((e) => {
        if (!cancelled)
          setState({
            status: "error",
            message: e instanceof Error ? e.message : "조회 실패",
          });
      });
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  if (state.status === "loading") {
    return <div className="p-8 text-center text-sm text-[#56607a]">불러오는 중...</div>;
  }
  if (state.status === "no-key") {
    return (
      <div className="rounded-[12px] border border-[#eaecf3] bg-[#fbfcff] p-8 text-center text-sm text-[#56607a]">
        Turing API 키가 설정되지 않아 AI 성능 지표를 불러올 수 없습니다.
        (VITE_TURING_API_KEY)
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className="rounded-[12px] border border-red-200 bg-red-50 p-8 text-center text-sm text-red-700">
        {state.message}
      </div>
    );
  }
  if (state.status === "empty") {
    return (
      <div className="rounded-[12px] border border-[#eaecf3] bg-[#fbfcff] p-8 text-center text-sm text-[#56607a]">
        이 요청에 대한 AI 성능 평가 데이터가 없습니다.
      </div>
    );
  }
  return <AiMetricsPanel cards={state.cards} />;
}

/** Figma "S/O/A/P" 요약 카드 — 두 색을 번갈아 씀 */
function SummaryCard({
  tag,
  label,
  items,
  tone,
}: {
  tag: string;
  label: string;
  items: string[];
  tone: "blue" | "plain";
}) {
  return (
    <div
      className={`rounded-[12px] border border-[#e5e7e9] p-4 ${
        tone === "blue" ? "bg-[#ebf0ff]" : "bg-[#fbfcff]"
      }`}
    >
      <div className="mb-2 flex items-start gap-2 text-[16px] uppercase tracking-[-0.02em]">
        <span className="font-bold text-[#052699]">{tag}</span>
        <span className="flex-1 text-[#56607a]">{label}</span>
      </div>
      <ul className="list-disc space-y-1 pl-6 text-[16px] leading-5 tracking-[-0.02em] text-[#1a1a1a]">
        {items.map((text, i) => (
          <li key={i}>{text}</li>
        ))}
      </ul>
    </div>
  );
}

function SoapSummary({ detail }: { detail: RequestDetail }) {
  const cards: { tag: string; label: string; items?: string[] | null }[] = [
    { tag: "S", label: "의사 소견", items: detail.doctor_notes },
    { tag: "O", label: "검사 결과", items: detail.test_results },
    { tag: "A", label: "증상 및 환자 기록", items: detail.symptom_record },
    { tag: "P", label: "처방 및 관리", items: detail.prescription_and_care },
  ].filter((c) => c.items?.length);

  if (cards.length === 0) return <span className="text-[#56607a]">-</span>;

  return (
    <div className="flex flex-col gap-2">
      {cards.map((c, i) => (
        <SummaryCard
          key={c.tag}
          tag={c.tag}
          label={c.label}
          items={c.items as string[]}
          tone={i % 2 === 0 ? "blue" : "plain"}
        />
      ))}
    </div>
  );
}

function CnttSummary({ detail }: { detail: RequestDetail }) {
  const cards = [
    { tag: "C", label: "상황", value: detail.context },
    { tag: "I", label: "요청 의도", value: detail.intent },
    { tag: "A", label: "처리 내용", value: detail.action },
    { tag: "R", label: "결과", value: detail.result },
    { tag: "I", label: "이슈", value: detail.issue },
  ].filter((c) => c.value);

  if (cards.length === 0) return <span className="text-[#56607a]">-</span>;

  return (
    <div className="flex flex-col gap-2">
      {cards.map((c, i) => (
        <SummaryCard
          key={c.label}
          tag={c.tag}
          label={c.label}
          items={[c.value as string]}
          tone={i % 2 === 0 ? "blue" : "plain"}
        />
      ))}
    </div>
  );
}

const CNTT_ROLE_MAP: Record<string, string> = {
  csr: "상담원",
  customer: "고객",
};

/** 화자별 배지 색 — 실제 role 문자열이 무엇이든 등장 순서대로 두 톤을 번갈아 입힘 */
function useRoleTone(rawRoles: string[]) {
  return useMemo(() => {
    const order: string[] = [];
    for (const r of rawRoles) if (!order.includes(r)) order.push(r);
    const map: Record<string, "teal" | "indigo"> = {};
    order.forEach((r, i) => {
      map[r] = i % 2 === 0 ? "teal" : "indigo";
    });
    return map;
  }, [rawRoles]);
}

function TranscriptTable({
  items,
  isCntt,
}: {
  items: unknown[] | null;
  isCntt?: boolean;
}) {
  const sorted = useMemo(
    () =>
      [...((items ?? []) as { role?: string; index?: number; content?: string }[])].sort(
        (a, b) => (a.index ?? 0) - (b.index ?? 0)
      ),
    [items]
  );
  const roleTone = useRoleTone(sorted.map((s) => s.role ?? ""));

  if (!items?.length) return <span className="text-[#56607a]">-</span>;

  return (
    <div className="w-full overflow-hidden rounded-[12px] border border-[#efe7f2]">
      <div className="flex gap-5 border-b border-[#eaecf3] bg-[#f5f6f9] px-4 py-2 text-[12px] uppercase tracking-[-0.02em] text-[#56607a]">
        <p className="w-[60px] shrink-0">화자</p>
        <p className="flex-1">기록</p>
      </div>
      {sorted.map((item, i) => {
        const rawRole = item.role ?? "";
        const displayRole = isCntt ? (CNTT_ROLE_MAP[rawRole] ?? rawRole) : rawRole;
        const tone = roleTone[rawRole] ?? "teal";
        return (
          <div
            key={i}
            className="flex items-center gap-5 border-b border-[#efe7f2] bg-white px-4 py-2 last:border-b-0"
          >
            <span
              className={`flex h-6 w-[60px] shrink-0 items-center justify-center rounded-full text-[12px] font-bold tracking-[-0.02em] ${
                tone === "teal"
                  ? "bg-[rgba(64,224,208,0.2)] text-black"
                  : "bg-[#ebf0ff] text-[#052699]"
              }`}
            >
              {displayRole || "-"}
            </span>
            <p className="flex-1 text-[16px] leading-5 tracking-[-0.02em] text-[#1a1a1a]">
              {item.content ?? ""}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function ErrorDetail({ detail }: { detail: RequestDetail }) {
  const err = detail.error as {
    code?: string;
    type?: string;
    message?: string;
    stage?: string;
  } | null;

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-[12px] border border-red-200 bg-red-50 p-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-lg text-red-500">⚠</span>
          <div className="min-w-0 flex-1">
            <h3 className="mb-1 text-sm font-semibold text-red-800">
              처리 중 오류가 발생했습니다
            </h3>
            {err?.message && <p className="text-sm text-red-700">{err.message}</p>}
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-black">요청 정보</h3>
        <div className="divide-y divide-[#eaecf3] rounded-[12px] bg-[#fbfcff] text-sm">
          {err?.code && (
            <div className="flex px-4 py-2.5">
              <span className="w-28 shrink-0 font-medium text-[#56607a]">
                에러 코드
              </span>
              <span className="font-mono text-xs text-black">{err.code}</span>
            </div>
          )}
          <div className="flex px-4 py-2.5">
            <span className="w-28 shrink-0 font-medium text-[#56607a]">Job ID</span>
            <span className="break-all font-mono text-xs text-black">
              {detail.job_id}
            </span>
          </div>
          {detail.created_at && (
            <div className="flex px-4 py-2.5">
              <span className="w-28 shrink-0 font-medium text-[#56607a]">
                요청 시각
              </span>
              <span className="text-black">
                {new Date(detail.created_at).toLocaleString("ko-KR")}
              </span>
            </div>
          )}
          {detail.processing_time_ms != null && (
            <div className="flex px-4 py-2.5">
              <span className="w-28 shrink-0 font-medium text-[#56607a]">
                처리 시간
              </span>
              <span className="text-black">
                {(detail.processing_time_ms / 1000).toFixed(2)}초
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function HistoryDetail() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const summaryType = getSummaryType();
  const isCntt = summaryType === "cntt";

  const [detail, setDetail] = useState<RequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"summary" | "metrics">("summary");
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [healthRefreshing, setHealthRefreshing] = useState(false);

  const refreshHealth = () => {
    setHealthRefreshing(true);
    setHealth(null);
    getHealthCheck()
      .then((h) => setHealth(h))
      .catch(() => setHealth({ ok: false, status: "error", message: "연결 실패" }))
      .finally(() => setHealthRefreshing(false));
  };

  useEffect(() => {
    refreshHealth();
  }, []);

  useEffect(() => {
    if (!jobId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    const fetch = isCntt ? getCnttRequestDetail(jobId) : getRequestDetail(jobId);
    fetch
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "상세 조회 실패");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [jobId, isCntt]);

  const headerActions = (
    <>
      <ServerStatusBadge
        health={health}
        healthRefreshing={healthRefreshing}
        onRefresh={refreshHealth}
      />
    </>
  );

  const backButton = (
    <button
      type="button"
      onClick={() => navigate("/history")}
      title="목록으로"
      className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg border border-[#d4d8e8] bg-white"
    >
      <img src={iconBack} alt="뒤로" className="h-5 w-5" />
    </button>
  );

  if (!jobId) {
    return (
      <div className="p-8 text-[#56607a]">
        job_id가 없습니다.{" "}
        <button
          type="button"
          onClick={() => navigate("/history")}
          className="text-black hover:underline"
        >
          사용 내역으로
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div>
        <PageHeader
          variant="flat"
          title="요청 상세"
          subtitle="요청∙작업 내역의 상세 정보를 확인해 보세요."
          actions={
            <div className="flex items-center gap-4">
              {backButton}
              {headerActions}
            </div>
          }
        />
        <div className="p-8 text-[#56607a]">불러오는 중...</div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div>
        <PageHeader
          variant="flat"
          title="요청 상세"
          subtitle="요청∙작업 내역의 상세 정보를 확인해 보세요."
          actions={
            <div className="flex items-center gap-4">
              {backButton}
              {headerActions}
            </div>
          }
        />
        <div className="p-8 text-red-600">
          {error ?? "데이터 없음"}
          <div className="mt-4">
            <button
              type="button"
              onClick={() => navigate("/history")}
              className="rounded-lg bg-[#f5f6f9] px-3 py-1.5 text-sm font-medium text-black hover:bg-[#eaecf3]"
            >
              목록으로
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isError = detail.status === "error" || detail.status === "failed";

  return (
    <div className="pb-4">
      <PageHeader
        variant="flat"
        title="요청 상세"
        subtitle="요청∙작업 내역의 상세 정보를 확인해 보세요."
        actions={
          <div className="flex items-center gap-4">
            {backButton}
            {headerActions}
          </div>
        }
      />

      <div className="-mx-4 h-2 bg-[#f5f6f9] sm:-mx-6 lg:-mx-8" />

      <div className="flex flex-col gap-7 py-7">
        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={() => setTab("summary")}
            className={`flex items-center justify-center pb-2 text-[16px] font-bold tracking-[-0.02em] ${
              tab === "summary"
                ? "border-b-2 border-[#04044a] text-black"
                : "text-[#97a0b8]"
            }`}
          >
            요약 및 기록
          </button>
          <button
            type="button"
            onClick={() => setTab("metrics")}
            className={`flex items-center justify-center pb-2 text-[16px] font-medium tracking-[-0.02em] ${
              tab === "metrics"
                ? "border-b-2 border-[#04044a] text-black"
                : "text-[#97a0b8]"
            }`}
          >
            AI 성능 지표
          </button>
        </div>

        {tab === "metrics" ? (
          <AiMetricsTab jobId={jobId} />
        ) : isError ? (
          <ErrorDetail detail={detail} />
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <img src={iconSummary} alt="" className="h-5 w-5" />
                <h3 className="text-[16px] font-bold tracking-[-0.02em] text-black">
                  요약
                </h3>
              </div>
              {isCntt ? (
                <CnttSummary detail={detail} />
              ) : (
                <SoapSummary detail={detail} />
              )}
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <img src={iconTranscript} alt="" className="h-5 w-5" />
                <h3 className="text-[16px] font-bold tracking-[-0.02em] text-black">
                  전사된 기록
                </h3>
              </div>
              <TranscriptTable
                items={detail.conversation_content ?? []}
                isCntt={isCntt}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
