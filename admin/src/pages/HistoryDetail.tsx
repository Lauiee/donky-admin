import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getCnttRequestDetail,
  getRequestDetail,
  type RequestDetail,
} from "../api";
import { getSummaryType } from "../auth";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <h3 className="text-sm font-semibold text-brand-navy mb-2">{title}</h3>
      <div className="bg-brand-surface rounded-lg p-4 text-sm text-brand-navy">
        {children}
      </div>
    </div>
  );
}

const CNTT_ROLE_MAP: Record<string, string> = {
  csr: "상담원",
  customer: "고객",
};

function TranscriptionBlock({
  items,
  isCntt,
}: {
  items: unknown[] | null;
  isCntt?: boolean;
}) {
  if (!items?.length) return <span className="text-brand-slate">-</span>;

  const sorted = [...(items as { role?: string; index?: number; content?: string }[])].sort(
    (a, b) => (a.index ?? 0) - (b.index ?? 0)
  );

  return (
    <div className="space-y-2 whitespace-pre-wrap">
      {sorted.map((item, i) => {
        const rawRole = item.role ?? "";
        const displayRole = isCntt
          ? (CNTT_ROLE_MAP[rawRole] ?? rawRole)
          : rawRole;
        return (
          <p key={i}>
            {displayRole ? (
              <>
                <span className="font-medium text-brand-ink">{displayRole}: </span>
                {item.content ?? ""}
              </>
            ) : (
              String(item.content ?? item)
            )}
          </p>
        );
      })}
    </div>
  );
}

function SummaryList({
  label,
  items,
}: {
  label: string;
  items: string[] | null | undefined;
}) {
  if (!items?.length) return null;
  return (
    <div className="mb-4 last:mb-0">
      <h4 className="text-xs font-semibold text-brand-slate mb-1.5">{label}</h4>
      <ul className="list-disc list-inside space-y-1 text-brand-navy">
        {items.map((text, i) => (
          <li key={i}>{text}</li>
        ))}
      </ul>
    </div>
  );
}

function CiarField({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  if (!value) return null;
  return (
    <div className="mb-4 last:mb-0">
      <h4 className="text-xs font-semibold text-brand-slate mb-1.5">{label}</h4>
      <p className="text-brand-navy">{value}</p>
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
    <div className="space-y-6">
      <div className="rounded-lg border border-red-200 bg-red-50 p-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-red-500 text-lg">⚠</span>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-red-800 mb-1">
              처리 중 오류가 발생했습니다
            </h3>
            {err?.message && (
              <p className="text-sm text-red-700">{err.message}</p>
            )}
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-brand-navy mb-2">요청 정보</h3>
        <div className="bg-brand-surface rounded-lg divide-y divide-brand-line text-sm">
          {err?.code && (
            <div className="flex px-4 py-2.5">
              <span className="w-28 shrink-0 font-medium text-brand-slate">
                에러 코드
              </span>
              <span className="text-brand-ink font-mono text-xs">
                {err.code}
              </span>
            </div>
          )}
          <div className="flex px-4 py-2.5">
            <span className="w-28 shrink-0 font-medium text-brand-slate">
              Job ID
            </span>
            <span className="text-brand-ink font-mono text-xs break-all">
              {detail.job_id}
            </span>
          </div>
          {detail.file_url && (
            <div className="flex px-4 py-2.5">
              <span className="w-28 shrink-0 font-medium text-brand-slate">
                음성 URL
              </span>
              <span className="text-brand-ink text-xs break-all">
                {detail.file_url}
              </span>
            </div>
          )}
          {detail.created_at && (
            <div className="flex px-4 py-2.5">
              <span className="w-28 shrink-0 font-medium text-brand-slate">
                요청 시각
              </span>
              <span className="text-brand-ink">
                {new Date(detail.created_at).toLocaleString("ko-KR")}
              </span>
            </div>
          )}
          {detail.processing_time_ms != null && (
            <div className="flex px-4 py-2.5">
              <span className="w-28 shrink-0 font-medium text-brand-slate">
                처리 시간
              </span>
              <span className="text-brand-ink">
                {(detail.processing_time_ms / 1000).toFixed(2)}초
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CnttSummary({ detail }: { detail: RequestDetail }) {
  const hasAny =
    detail.context ||
    detail.intent ||
    detail.action ||
    detail.result ||
    detail.issue;

  if (!hasAny) return <span className="text-brand-slate">-</span>;

  return (
    <>
      <CiarField label="상황" value={detail.context} />
      <CiarField label="요청 의도" value={detail.intent} />
      <CiarField label="처리 내용" value={detail.action} />
      <CiarField label="결과" value={detail.result} />
      <CiarField label="이슈" value={detail.issue} />
    </>
  );
}

function SoapSummary({ detail }: { detail: RequestDetail }) {
  const hasAny =
    detail.doctor_notes?.length ||
    detail.test_results?.length ||
    detail.symptom_record?.length ||
    detail.prescription_and_care?.length;

  if (!hasAny) return <span className="text-brand-slate">-</span>;

  return (
    <>
      <SummaryList label="의사 소견" items={detail.doctor_notes} />
      <SummaryList label="검사 결과" items={detail.test_results} />
      <SummaryList label="증상 기록" items={detail.symptom_record} />
      <SummaryList label="처방 및 관리" items={detail.prescription_and_care} />
    </>
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

  useEffect(() => {
    if (!jobId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    const fetch = isCntt
      ? getCnttRequestDetail(jobId)
      : getRequestDetail(jobId);
    fetch
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((e) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "상세 조회 실패");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [jobId, isCntt]);

  if (!jobId) {
    return (
      <div className="admin-card p-8 text-brand-slate">
        job_id가 없습니다.{" "}
        <button
          type="button"
          onClick={() => navigate("/history")}
          className="text-brand-navy hover:underline"
        >
          사용 내역으로
        </button>
      </div>
    );
  }

  if (loading) {
    return <div className="admin-card p-8 text-brand-slate">불러오는 중...</div>;
  }

  if (error || !detail) {
    return (
      <div className="admin-card p-8 text-red-600">
        {error ?? "데이터 없음"}
        <div className="mt-4">
          <button
            type="button"
            onClick={() => navigate("/history")}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-brand-surface hover:bg-brand-line/50 text-brand-navy"
          >
            목록으로
          </button>
        </div>
      </div>
    );
  }

  const isError = detail.status === "error" || detail.status === "failed";

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <button
          type="button"
          onClick={() => navigate("/history")}
          className="px-3 py-1.5 rounded-lg text-sm font-medium text-brand-navy bg-brand-surface hover:bg-brand-line/50"
        >
          ← 목록
        </button>
        <h2 className="admin-page-title">요청 상세</h2>
      </div>

      <div className="admin-card p-6">
        {isError ? (
          <ErrorDetail detail={detail} />
        ) : (
          <>
            <Section title="전사한 내용 전체">
              <TranscriptionBlock
                items={detail.conversation_content ?? []}
                isCntt={isCntt}
              />
            </Section>

            <Section title="요약">
              {isCntt ? (
                <CnttSummary detail={detail} />
              ) : (
                <SoapSummary detail={detail} />
              )}
            </Section>
          </>
        )}
      </div>
    </div>
  );
}
