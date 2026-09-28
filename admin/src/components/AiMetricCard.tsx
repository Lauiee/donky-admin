import { useId, useState } from "react";
import {
  buildDisplayLegend,
  type AiMetricCardData,
  type AiMetricSeriesPoint,
} from "../turing/aiMetricCards";
import { TIER_LABEL, type MetricTier } from "../turing/metricGrades";

/** "AI 성능 지표" 카드 스타일 — 4가지 중 하나. 고객사별로 고정 설정(파라미터) — 사용자가 토글하는 값이 아님. */
export type AiMetricCardVariant = "sparkline" | "donut" | "line" | "areaBig";

const GRADE_STYLE: Record<
  MetricTier,
  { bg: string; border: string; dot: string; text: string }
> = {
  excellent: {
    bg: "bg-[#d4e0ff]",
    border: "border-[rgba(5,38,153,0.2)]",
    dot: "bg-[#052699]",
    text: "text-[#052699]",
  },
  medium: {
    bg: "bg-[#fdf3df]",
    border: "border-[rgba(242,174,0,0.2)]",
    dot: "bg-[#f2ae00]",
    text: "text-[#f2ae00]",
  },
  poor: {
    bg: "bg-[#fbe6e6]",
    border: "border-[rgba(241,62,62,0.2)]",
    dot: "bg-[#f13e3e]",
    text: "text-[#f13e3e]",
  },
};

function GradeBadge({ grade }: { grade: MetricTier }) {
  const s = GRADE_STYLE[grade];
  return (
    <div
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-[7px] py-[3px] ${s.bg} ${s.border}`}
    >
      <span className={`size-[6px] shrink-0 rounded-full ${s.dot}`} />
      <span className={`text-[10px] font-semibold tracking-[-0.04px] ${s.text}`}>
        {TIER_LABEL[grade]}
      </span>
    </div>
  );
}

/**
 * 값 하나짜리 도넛 링 — 0~100%.
 * 건별 상세는 시점 하나뿐이라 과거 이력이 없음 (variant 2는 그래도 온전히 표현 가능).
 */
function DonutRing({ value, grade }: { value: number; grade: MetricTier }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - value / 100);
  const color = GRADE_STYLE[grade].dot.match(/#[0-9a-fA-F]{6}/)?.[0] ?? "#052699";
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" className="shrink-0 -rotate-90">
      <circle cx="28" cy="28" r={r} fill="none" stroke="#eaecf3" strokeWidth="6" />
      <circle
        cx="28"
        cy="28"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
      />
      <text
        x="28"
        y="28"
        textAnchor="middle"
        dominantBaseline="central"
        transform="rotate(90 28 28)"
        className="fill-[#0e1220] text-[13px] font-bold"
      >
        {value}%
      </text>
    </svg>
  );
}

/**
 * 최근 평가 추이(series)가 2건 미만일 때의 대체 표시 — 값 높이에 맞춘 평평한
 * 기준선만 보여줌 (데이터가 부족한데 가짜 굴곡을 그리지 않기 위한 정직한 절충).
 */
function FlatBaseline({
  value,
  grade,
  height,
  big,
}: {
  value: number;
  grade: MetricTier;
  height: number;
  big?: boolean;
}) {
  const color = GRADE_STYLE[grade].dot.match(/#[0-9a-fA-F]{6}/)?.[0] ?? "#052699";
  const y = height - (height - 4) * (value / 100) - 2;
  const gradId = useId();
  return (
    <svg
      viewBox={`0 0 200 ${height}`}
      preserveAspectRatio="none"
      className="block w-full"
      style={{ height }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.4} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={`M0 ${height} L0 ${y} L200 ${y} L200 ${height} Z`} fill={`url(#${gradId})`} />
      <line x1="0" y1={y} x2="200" y2={y} stroke={color} strokeWidth={big ? 1.75 : 1.15} />
      <circle cx="196" cy={y} r={8} fill="transparent">
        <title>{`현재값: ${value}%`}</title>
      </circle>
      <circle cx="196" cy={y} r={big ? 4 : 3} fill={color} className="pointer-events-none" />
    </svg>
  );
}

/** Catmull-Rom → Cubic Bezier — Figma 목업처럼 부드러운 곡선 (직선 꺾은선 대신) */
function smoothPathD(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)} ${cp2x.toFixed(2)} ${cp2y.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

/** 실제 최근 평가 추이(≥2건)로 그리는 진짜 선/영역 그래프 */
function TrendSpark({
  series,
  grade,
  height,
  big,
  showLastLabel,
}: {
  series: AiMetricSeriesPoint[];
  grade: MetricTier;
  height: number;
  big?: boolean;
  showLastLabel?: boolean;
}) {
  const color = GRADE_STYLE[grade].dot.match(/#[0-9a-fA-F]{6}/)?.[0] ?? "#052699";
  const w = 200;
  const padTop = 4;
  const innerH = height - padTop - 2;
  const min = Math.min(...series.map((p) => p.value));
  const max = Math.max(...series.map((p) => p.value));
  const span = max - min || 1;
  const pts = series.map((p, i) => ({
    x: series.length === 1 ? w : (i / (series.length - 1)) * w,
    y: padTop + innerH * (1 - (p.value - min) / span),
  }));
  const line = smoothPathD(pts);
  const area = `M ${pts[0].x} ${height} L ${pts[0].x} ${pts[0].y} ${line.replace(/^M[^C]*/, "")} L ${pts[pts.length - 1].x} ${height} Z`;
  const last = series[series.length - 1];
  const gradId = useId();

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="block w-full" style={{ height }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.4} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gradId})`} />
        <path d={line} fill="none" stroke={color} strokeWidth={big ? 1.75 : 1.15} strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={9} fill="transparent">
              <title>{`${series[i].label}: ${series[i].value}%`}</title>
            </circle>
            <circle
              cx={p.x}
              cy={p.y}
              r={i === pts.length - 1 ? (big ? 4 : 3) : big ? 2.5 : 1.75}
              fill={color}
              className="pointer-events-none"
            />
          </g>
        ))}
      </svg>
      {showLastLabel && (
        <span className="pointer-events-none absolute right-0 top-0 text-[10px] text-[#97a0b8]">
          {last.label}
        </span>
      )}
    </div>
  );
}

/**
 * 등급 임계값 범례 — 구 Turing 카드처럼 펼치지 않아도 항상 보임.
 * (역수 표시 지표는 안내 문구도 함께.)
 */
function MetricLegend({ slug, lowerIsBetter }: { slug: string; lowerIsBetter?: boolean }) {
  const rows = buildDisplayLegend(slug);
  if (rows.length === 0) return null;
  return (
    <div className="flex flex-col gap-1 border-t border-[#eaecf3] pt-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {rows.map((r) => {
          const s = GRADE_STYLE[r.tier];
          return (
            <div key={r.tier} className="flex min-w-0 items-center gap-1">
              <span className={`size-[6px] shrink-0 rounded-full ${s.dot}`} />
              <span className={`shrink-0 text-[10px] font-semibold ${s.text}`}>
                {TIER_LABEL[r.tier]}
              </span>
              <span className="whitespace-nowrap text-[10px] text-[#56607a]">
                {r.condition}
              </span>
            </div>
          );
        })}
      </div>
      {lowerIsBetter && (
        <p className="text-[9px] leading-3.5 text-[#97a0b8]">
          원래는 낮을수록 좋은 지표라, 표시값은 역수(100 − 원본값%)입니다. 여기선
          값이 높을수록 좋습니다.
        </p>
      )}
    </div>
  );
}

export function AiMetricCard({
  data,
  variant,
}: {
  data: AiMetricCardData;
  variant: AiMetricCardVariant;
}) {
  const [expanded, setExpanded] = useState(false);
  const { group, slug, label, description, value, grade, series, highlight, lowerIsBetter } =
    data;
  if (value == null || grade == null) return null;
  const chartHeight = expanded ? 64 : variant === "areaBig" ? 56 : variant === "line" ? 40 : 28;
  const chartBig = expanded || variant === "areaBig" || variant === "line";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => setExpanded((v) => !v)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setExpanded((v) => !v);
        }
      }}
      className={`flex min-w-0 flex-1 cursor-pointer flex-col gap-2 overflow-hidden rounded-[12px] border p-[13px] transition-shadow hover:shadow-md ${
        highlight
          ? "border-sky-300 bg-sky-50/60 ring-1 ring-sky-200"
          : "border-[#eaecf3] bg-white"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="rounded-[4px] bg-[#eaecf3] px-2 py-0.5 text-[10px] font-semibold text-[#222a3d]">
          {group}
        </span>
        {highlight && (
          <span className="rounded-full bg-sky-200/70 px-2 py-0.5 text-[10px] font-semibold text-sky-800">
            CS 특화
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 truncate text-[16px] font-semibold tracking-[-0.02em] text-[#0e1220]">
            {label}
          </p>
          <GradeBadge grade={grade} />
        </div>
        <p className="line-clamp-2 text-[12px] leading-4 tracking-[-0.02em] text-[#39435a]">
          {description}
        </p>
      </div>

      {variant === "donut" ? (
        <div className="flex items-center gap-3">
          <DonutRing value={value} grade={grade} />
        </div>
      ) : (
        <>
          <p className="text-[24px] font-bold leading-6 text-[#0e1220]">{value}%</p>
          {series && series.length >= 2 ? (
            <TrendSpark
              series={series}
              grade={grade}
              height={chartHeight}
              big={chartBig}
              showLastLabel={variant === "line"}
            />
          ) : (
            <FlatBaseline value={value} grade={grade} height={chartHeight} big={chartBig} />
          )}
        </>
      )}

      <MetricLegend slug={slug} lowerIsBetter={lowerIsBetter} />
    </div>
  );
}
