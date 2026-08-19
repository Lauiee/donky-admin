import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { HeptagonRadar } from "./HeptagonRadar";
import {
  gradeMetricBySlug,
  higherRatioToRadius01,
  lowerRatioToRadius01,
  metricThresholdLegendBySlug,
  sttVelocityRatioToRadius01,
  summarizationVelocityToRadius01,
  type MetricTier,
} from "./metricGrades";
import {
  TuringMetricGrid,
  TuringMetricsStack,
  type MetricTrendPoint,
  type TuringMetricGridItem,
} from "./TuringMetricCard";
import { formatMetricValue } from "./turingFormat";
import {
  CS_DETAIL_METRICS,
  TURING_EVALUATIONS_PAGE_SIZE,
  VELOCITY_METRIC_DESCRIPTIONS,
} from "./turingConfig";
import { getDetailMetricsForDomain, getTuringLabelSet } from "./turingLabels";
import { getTuringDomain } from "../auth";
import { TuringLineChart } from "./TuringLineChart";
import {
  aggregateEvaluationItems,
  tiersForSttRadarNullable,
  tiersForSummaryRadarNullable,
  type TuringDemoState,
} from "./turingAggregate";
import { averageSamples } from "./turingSampleAverages";
import {
  fetchTuringEvaluations,
  hasTuringApiKey,
  type EvaluationListItemApi,
} from "./turingApi";
import { TuringHoverDescription } from "./TuringHoverDescription";
import { VelocityGauge } from "./VelocityGauge";
import { TURING_GAUGE_THUMB_LINE } from "./turingGaugeTheme";

/**
 * 목데이터 모드. true 이면 실제 Turing API 대신 고정 목업 데이터를 사용한다.
 * (실 API 연동 복구 시 false 로 변경 — .env 의 VITE_TURING_API_KEY 사용)
 */
const USE_MOCK_DATA = false;

const SAMP = {
  processingVelocity: [
    0.71, 0.73, 0.7, 0.74, 0.72, 0.71, 0.75, 0.72, 0.73, 0.71,
  ],
  summarizationVelocity: [
    0.63, 0.66, 0.64, 0.67, 0.65, 0.64, 0.66, 0.65, 0.64, 0.65,
  ],
  sttVelocityRatio: [
    0.34, 0.36, 0.33, 0.37, 0.35, 0.34, 0.36, 0.35, 0.34, 0.35,
  ],
  uer: [0.07, 0.09, 0.08, 0.08, 0.09, 0.07, 0.08, 0.08, 0.09, 0.08],
  piiProtection: [
    0.91, 0.93, 0.92, 0.92, 0.91, 0.93, 0.92, 0.91, 0.93, 0.92,
  ],
  mmr: [0.11, 0.13, 0.12, 0.12, 0.11, 0.12, 0.13, 0.12, 0.11, 0.12],
  mdr: [0.07, 0.09, 0.08, 0.08, 0.09, 0.07, 0.08, 0.08, 0.09, 0.08],
  diarizationAccuracy: [
    0.81, 0.83, 0.82, 0.82, 0.81, 0.83, 0.82, 0.81, 0.83, 0.82,
  ],
  redundancyRatio: [
    0.03, 0.05, 0.04, 0.04, 0.03, 0.04, 0.05, 0.04, 0.03, 0.04,
  ],
  summaryHallucination: [
    0.11, 0.13, 0.12, 0.12, 0.11, 0.13, 0.12, 0.11, 0.12, 0.12,
  ],
  ssr: [0.74, 0.76, 0.75, 0.75, 0.74, 0.76, 0.75, 0.74, 0.76, 0.75],
  icr: [0.44, 0.46, 0.45, 0.45, 0.44, 0.46, 0.45, 0.44, 0.46, 0.45],
  summaryMdr: [
    0.07, 0.09, 0.08, 0.08, 0.09, 0.07, 0.08, 0.08, 0.09, 0.08,
  ],
  mir: [0.71, 0.73, 0.72, 0.72, 0.71, 0.73, 0.72, 0.71, 0.73, 0.72],
  ssa: [0.77, 0.79, 0.78, 0.78, 0.77, 0.79, 0.78, 0.77, 0.79, 0.78],
} as const;

const PER_CASE_COMPOSITE_FALLBACK = [63, 61, 66, 64, 62, 63, 67, 65, 64, 66];

/** 엑셀에서 하늘색으로 표시된 CS 도메인 특화 지표 slug (카드 하늘색 강조 대상) */
const CS_SPECIAL_SLUGS = new Set([
  "CKM",
  "CKD",
  "CIR",
  "KCR",
  "IDR",
  "AC",
  "RRS",
  "CSR_TURN",
]);

/**
 * 목업 데모 데이터. 등급 분포 의도: 대부분 우수 / 약 1/3 보통 / 미흡은 HR 단 하나.
 * (상세 16개 카드 기준 우수 10 · 보통 5 · 미흡 1, Velocity 포함 시 우수 12 · 보통 6 · 미흡 1)
 * 값은 metricGrades 임계값에 맞춰 고정.
 */
function buildFallbackDemo(): TuringDemoState {
  return {
    processingVelocity01: 0.22, // 우수 (<0.3)
    summarizationVelocity01: 0.18, // 보통 (0.1~0.3)
    stt: {
      velocityRatio: 0.15, // 우수 (<0.2)
      uer: 0.03, // 우수 (<0.05)
      piiProtection: 0.95, // 상세 미표시(엑셀 제외) — healthScore 가중용
      mmr: 0.06, // CKM 우수 (<0.1)
      mdr: 0.18, // CKD 보통 (0.1~0.3)
      diarizationAccuracy: 0.88, // 우수 (>0.8)
      redundancyRatio: 0.03, // 우수 (<0.05)
    },
    summary: {
      summarizationVelocity01: 0.18, // 보통
      hallucinationRatio: 0.35, // HR 미흡 (≥0.3) ← 유일한 미흡
      ssr: 0.82, // 우수 (>0.7)
      icr: 0.55, // 보통 (≥0.5)
      summaryMdr: 0.16, // CKD(요약) 보통 (0.1~0.3)
      mir: 0.78, // CIR 우수 (>0.7)
      ssa: 0.8, // 우수 (>0.7)
    },
  };
}

const STT_ROW_FORMATS: Array<"percent" | "seconds" | "invertedPercent"> = [
  "invertedPercent",
  "invertedPercent",
  "percent",
  "invertedPercent",
  "invertedPercent",
  "percent",
  "invertedPercent",
];

const SUM_ROW_FORMATS: Array<"percent" | "seconds" | "invertedPercent"> = [
  "invertedPercent",
  "invertedPercent",
  "percent",
  "invertedPercent",
  "invertedPercent",
  "percent",
  "percent",
];

type MetricTrendSeriesGroup = {
  stt: MetricTrendPoint[][];
  summary: MetricTrendPoint[][];
};

function formatTrendTimeLabel(iso: string): { short: string; full: string } {
  if (typeof iso === "string" && iso.length >= 16) {
    const m = iso.match(
      /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/
    );
    if (m) {
      const [, yyyy, MM, DD, HH, mm] = m;
      return {
        short: `${MM}/${DD} ${HH}:${mm}`,
        full: `${yyyy}-${MM}-${DD} ${HH}:${mm}`,
      };
    }
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return { short: "--/-- --:--", full: String(iso) };
  }
  const MM = String(d.getMonth() + 1).padStart(2, "0");
  const DD = String(d.getDate()).padStart(2, "0");
  const HH = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return {
    short: `${MM}/${DD} ${HH}:${mm}`,
    full: d.toLocaleString(),
  };
}

function buildMetricTrendSeriesFromItems(
  items: EvaluationListItemApi[]
): MetricTrendSeriesGroup {
  const sorted = [...items].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const sttExtractors: Array<(x: EvaluationListItemApi) => number | null> = [
    (x) => x.metrics.stt.stt_velocity,
    (x) => x.metrics.stt.uer,
    (x) => x.metrics.stt.pii_protection,
    (x) => x.metrics.stt.mmr,
    (x) => x.metrics.stt.mdr,
    (x) => x.metrics.stt.diarization_accuracy,
    (x) => x.metrics.stt.redundancy_ratio,
  ];
  const summaryExtractors: Array<(x: EvaluationListItemApi) => number | null> = [
    (x) => x.metrics.summary.summarization_velocity,
    (x) => x.metrics.summary.hallucination_ratio,
    (x) => x.metrics.summary.ssr,
    (x) => x.metrics.summary.icr,
    (x) => x.metrics.summary.summary_mdr,
    (x) => x.metrics.summary.mir,
    (x) => x.metrics.summary.ssa,
  ];

  const build = (extractors: Array<(x: EvaluationListItemApi) => number | null>) =>
    extractors.map((read) =>
      sorted.flatMap((item, i) => {
        const v = read(item);
        if (v == null || Number.isNaN(v)) return [];
        const t = formatTrendTimeLabel(item.created_at);
        return [{ label: t.short, tooltipLabel: `${t.full} (#${i + 1})`, value: v }];
      })
    );

  return { stt: build(sttExtractors), summary: build(summaryExtractors) };
}

function buildFallbackMetricTrendSeries(): MetricTrendSeriesGroup {
  const now = Date.now();
  const timeLabel = (idx: number) => {
    const d = new Date(now - (9 - idx) * 60 * 60 * 1000);
    const MM = String(d.getMonth() + 1).padStart(2, "0");
    const DD = String(d.getDate()).padStart(2, "0");
    const HH = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${MM}/${DD} ${HH}:${mm}`;
  };
  const mapSeries = (vals: readonly number[]): MetricTrendPoint[] =>
    vals.map((value, i) => ({
      label: timeLabel(i),
      tooltipLabel: `Fallback ${timeLabel(i)}`,
      value,
    }));
  return {
    stt: [
      mapSeries(SAMP.sttVelocityRatio),
      mapSeries(SAMP.uer),
      mapSeries(SAMP.piiProtection),
      mapSeries(SAMP.mmr),
      mapSeries(SAMP.mdr),
      mapSeries(SAMP.diarizationAccuracy),
      mapSeries(SAMP.redundancyRatio),
    ],
    summary: [
      mapSeries(SAMP.summarizationVelocity),
      mapSeries(SAMP.summaryHallucination),
      mapSeries(SAMP.ssr),
      mapSeries(SAMP.icr),
      mapSeries(SAMP.summaryMdr),
      mapSeries(SAMP.mir),
      mapSeries(SAMP.ssa),
    ],
  };
}

function buildFallbackTrendTimeLabels(count: number): string[] {
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now - (count - 1 - i) * 60 * 60 * 1000);
    const MM = String(d.getMonth() + 1).padStart(2, "0");
    const DD = String(d.getDate()).padStart(2, "0");
    const HH = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${MM}/${DD} ${HH}:${mm}`;
  });
}

function SummarizationVelocitySlot({ value }: { value: number | null }) {
  if (value == null) {
    return (
      <div className="admin-card flex min-h-[260px] flex-col items-center justify-center p-5">
        <div className="mb-2 text-center text-sm font-medium text-brand-ink">
          <TuringHoverDescription
            label="Summarization Velocity"
            description={VELOCITY_METRIC_DESCRIPTIONS.summarization}
          />
        </div>
        <p className="text-sm text-brand-slate">요약 지표 미지원</p>
        <p className="mt-2 px-2 text-center text-xs text-brand-slate">
          API <code className="text-brand-navy">summary</code> 값이 null일 때
        </p>
      </div>
    );
  }
  return (
    <VelocityGauge
      variant="summarization"
      title="Summarization Velocity"
      metricDescription={VELOCITY_METRIC_DESCRIPTIONS.summarization}
      value01={value}
    />
  );
}

export type TuringDashboardViewProps = {
  /** 상단 PageHeader 제목 — 실험 페이지에서만 바꿔 쓰기 */
  pageTitle?: string;
  /** 상단 PageHeader 부제 */
  pageSubtitle?: string;
  /**
   * 상세 지표 영역 — `/turing` 은 레이더, `/turing-lab` 은 카드 그리드.
   * @default "radar"
   */
  detailLayout?: "radar" | "cards";
};

const DEFAULT_TITLE = "Turing";
const DEFAULT_SUBTITLE =
  "STT·요약 채점 지표와 최근 평가 추이를 확인합니다.";

function TuringSectionTitle({ title }: { title: string }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span
        className="h-[1.1rem] w-[2px] shrink-0 rounded-full ring-1 ring-white/80"
        style={{ backgroundColor: TURING_GAUGE_THUMB_LINE }}
        aria-hidden
      />
      <h3 className="text-sm font-semibold uppercase leading-none tracking-[0.08em] text-brand-navy/85">
        {title}
      </h3>
    </div>
  );
}

/**
 * Turing 대시보드 본문 — `/turing` 과 `/turing-lab` 에서 공용.
 * Lab 전용 UI는 `detailLayout="cards"` 로 분리 (`TuringLab.tsx`).
 */
export function TuringDashboardView({
  pageTitle = DEFAULT_TITLE,
  pageSubtitle = DEFAULT_SUBTITLE,
  detailLayout = "radar",
}: TuringDashboardViewProps) {
  const [demo, setDemo] = useState<TuringDemoState>(() => buildFallbackDemo());
  const [perCaseComposite, setPerCaseComposite] = useState<number[]>(
    () => PER_CASE_COMPOSITE_FALLBACK
  );
  const [trendTimeLabels, setTrendTimeLabels] = useState<string[]>(
    () => buildFallbackTrendTimeLabels(PER_CASE_COMPOSITE_FALLBACK.length)
  );
  const [trendTooltipLabels, setTrendTooltipLabels] = useState<string[]>(
    () => buildFallbackTrendTimeLabels(PER_CASE_COMPOSITE_FALLBACK.length)
  );
  const [sttMetricTrendSeries, setSttMetricTrendSeries] = useState<
    MetricTrendPoint[][]
  >(() => buildFallbackMetricTrendSeries().stt);
  const [summaryMetricTrendSeries, setSummaryMetricTrendSeries] = useState<
    MetricTrendPoint[][]
  >(() => buildFallbackMetricTrendSeries().summary);
  const [loading, setLoading] = useState(false);
  // 실제 API 데이터일 때만 채워지는 최근 평가 목록(상세 진입용). 샘플 폴백 시 비움.
  const [items, setItems] = useState<EvaluationListItemApi[]>([]);

  useEffect(() => {
    if (USE_MOCK_DATA || !hasTuringApiKey()) {
      setItems([]);
      setDemo(buildFallbackDemo());
      setPerCaseComposite(PER_CASE_COMPOSITE_FALLBACK);
      const fallbackTimes = buildFallbackTrendTimeLabels(
        PER_CASE_COMPOSITE_FALLBACK.length
      );
      setTrendTimeLabels(fallbackTimes);
      setTrendTooltipLabels(fallbackTimes.map((x) => `Fallback ${x}`));
      const fallback = buildFallbackMetricTrendSeries();
      setSttMetricTrendSeries(fallback.stt);
      setSummaryMetricTrendSeries(fallback.summary);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetchTuringEvaluations({
          page: 1,
          size: TURING_EVALUATIONS_PAGE_SIZE,
        });
        if (cancelled) return;
        if (res.items.length === 0) {
          setItems([]);
          setDemo(buildFallbackDemo());
          setPerCaseComposite(PER_CASE_COMPOSITE_FALLBACK);
          const fallbackTimes = buildFallbackTrendTimeLabels(
            PER_CASE_COMPOSITE_FALLBACK.length
          );
          setTrendTimeLabels(fallbackTimes);
          setTrendTooltipLabels(fallbackTimes.map((x) => `Fallback ${x}`));
          const fallback = buildFallbackMetricTrendSeries();
          setSttMetricTrendSeries(fallback.stt);
          setSummaryMetricTrendSeries(fallback.summary);
          return;
        }
        const agg = aggregateEvaluationItems(res.items);
        setDemo(agg.demo);
        setPerCaseComposite(agg.perCaseComposite);
        const sorted = [...res.items].sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        const labels = sorted.map((x) => formatTrendTimeLabel(x.created_at).short);
        const tips = sorted.map((x) => formatTrendTimeLabel(x.created_at).full);
        setTrendTimeLabels(labels);
        setTrendTooltipLabels(tips);
        const trendSeries = buildMetricTrendSeriesFromItems(res.items);
        setSttMetricTrendSeries(trendSeries.stt);
        setSummaryMetricTrendSeries(trendSeries.summary);
        setItems(res.items);
      } catch {
        if (!cancelled) {
          setItems([]);
          setDemo(buildFallbackDemo());
          setPerCaseComposite(PER_CASE_COMPOSITE_FALLBACK);
          const fallbackTimes = buildFallbackTrendTimeLabels(
            PER_CASE_COMPOSITE_FALLBACK.length
          );
          setTrendTimeLabels(fallbackTimes);
          setTrendTooltipLabels(fallbackTimes.map((x) => `Fallback ${x}`));
          const fallback = buildFallbackMetricTrendSeries();
          setSttMetricTrendSeries(fallback.stt);
          setSummaryMetricTrendSeries(fallback.summary);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const trendByCase = useMemo(
    () =>
      perCaseComposite.map((value, i) => ({
        label: trendTimeLabels[i] ?? `${i + 1}`,
        tooltipLabel: trendTooltipLabels[i],
        value,
      })),
    [perCaseComposite, trendTimeLabels, trendTooltipLabels]
  );

  // 최신순 정렬한 최근 평가(상세 진입용). 실제 API 데이터가 있을 때만 노출.
  const recentItems = useMemo(
    () =>
      [...items]
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        .slice(0, 10),
    [items]
  );

  // 로그인 계정에서 결정된 Turing 도메인 — cnt(상담) | hippo(의료).
  // 라벨/설명/Summary 섹션 표기가 도메인별로 갈린다. 슬러그·등급 로직은 공통.
  const domain = useMemo(() => getTuringDomain(), []);
  const labels = useMemo(() => getTuringLabelSet(domain), [domain]);
  const csDetailMetricsForDomain = useMemo(
    () => getDetailMetricsForDomain(domain, CS_DETAIL_METRICS),
    [domain]
  );

  // CS 도메인 상세 지표(엑셀 v0.2) — 전체 표시, CS 특화(하늘색)는 카드에서 강조.
  const csDetailItems = useMemo<TuringMetricGridItem[]>(
    () =>
      csDetailMetricsForDomain.map((m) => {
        const raw = m.read(demo);
        const unsupported = raw === null;
        const tier: MetricTier | "neutral" =
          raw == null ? "neutral" : gradeMetricBySlug(m.slug, raw);
        const trendSeries = m.trend
          ? (m.trend.group === "stt"
              ? sttMetricTrendSeries
              : summaryMetricTrendSeries)[m.trend.index] ?? []
          : [];
        return {
          key: `${m.group}-${m.slug}`,
          groupMeta: m.group,
          metricSlug: m.slug,
          title: m.label,
          description: m.description,
          tier,
          displayValue: formatMetricValue(raw, m.rowFormat),
          thumbPosition01: raw == null ? null : Math.min(1, Math.max(0, raw)),
          rowFormat: m.rowFormat,
          thresholdLegendRows: metricThresholdLegendBySlug(m.slug),
          unsupported,
          trendSeries,
          csSpecial: CS_SPECIAL_SLUGS.has(m.slug),
        };
      }),
    [csDetailMetricsForDomain, demo, sttMetricTrendSeries, summaryMetricTrendSeries]
  );

  const sttTiers = tiersForSttRadarNullable({
    sttVelocityRatio: demo.stt.velocityRatio,
    uer: demo.stt.uer,
    piiProtection: demo.stt.piiProtection,
    mmr: demo.stt.mmr,
    mdr: demo.stt.mdr,
    diarizationAccuracy: demo.stt.diarizationAccuracy,
    redundancyRatio: demo.stt.redundancyRatio,
  });

  const summaryTiers = tiersForSummaryRadarNullable({
    summarizationVelocity01: demo.summary.summarizationVelocity01,
    hallucinationRatio: demo.summary.hallucinationRatio,
    ssr: demo.summary.ssr,
    icr: demo.summary.icr,
    summaryMdr: demo.summary.summaryMdr,
    mir: demo.summary.mir,
    ssa: demo.summary.ssa,
  });

  const sttRadarDisplayValues: (number | null)[] = [
    demo.stt.velocityRatio,
    demo.stt.uer,
    demo.stt.piiProtection,
    demo.stt.mmr,
    demo.stt.mdr,
    demo.stt.diarizationAccuracy,
    demo.stt.redundancyRatio,
  ];
  // null=표본 없음 → 차트 축에서 가운데(0)로 표기하지 않고 명시적으로 null 전달
  const sttRadarChartRadii: (number | null)[] = [
    sttVelocityRatioToRadius01(demo.stt.velocityRatio),
    demo.stt.uer == null ? null : lowerRatioToRadius01(demo.stt.uer),
    demo.stt.piiProtection == null ? null : higherRatioToRadius01(demo.stt.piiProtection),
    demo.stt.mmr == null ? null : lowerRatioToRadius01(demo.stt.mmr),
    demo.stt.mdr == null ? null : lowerRatioToRadius01(demo.stt.mdr),
    demo.stt.diarizationAccuracy == null
      ? null
      : higherRatioToRadius01(demo.stt.diarizationAccuracy),
    demo.stt.redundancyRatio == null
      ? null
      : lowerRatioToRadius01(demo.stt.redundancyRatio),
  ];

  const summaryRadarDisplayValues: (number | null)[] = [
    demo.summary.summarizationVelocity01,
    demo.summary.hallucinationRatio,
    demo.summary.ssr,
    demo.summary.icr,
    demo.summary.summaryMdr,
    demo.summary.mir,
    demo.summary.ssa,
  ];
  const summaryRadarChartRadii: (number | null)[] = summaryRadarDisplayValues.map(
    (raw, i) => {
      if (raw === null) return null;
      switch (i) {
        case 0:
          return summarizationVelocityToRadius01(raw);
        case 1:
          return lowerRatioToRadius01(raw);
        case 2:
          return higherRatioToRadius01(raw);
        case 3:
          return lowerRatioToRadius01(raw);
        case 4:
          return lowerRatioToRadius01(raw);
        case 5:
          return higherRatioToRadius01(raw);
        case 6:
          return higherRatioToRadius01(raw);
        default:
          return raw;
      }
    }
  );

  // Detailed Metrics에서는 Velocity 섹션과 중복되는 속도 지표(첫 항목)를 제외한다.
  const sttDetailChartLabels = labels.sttRadarChartLabels.slice(1);
  const sttDetailListLabels = labels.sttRadarListLabels.slice(1);
  const sttDetailDescriptions = labels.sttMetricDescriptions.slice(1);
  const sttDetailSlugs = labels.sttMetricSlugs.slice(1);
  const sttDetailValues = sttRadarDisplayValues.slice(1);
  const sttDetailRadii = sttRadarChartRadii.slice(1);
  const sttDetailTiers = sttTiers.slice(1);
  const sttDetailRowFormats = STT_ROW_FORMATS.slice(1);
  const sttDetailTrendSeries = sttMetricTrendSeries.slice(1);

  const summaryDetailChartLabels = labels.summaryRadarChartLabels.slice(1);
  const summaryDetailListLabels = labels.summaryRadarListLabels.slice(1);
  const summaryDetailDescriptions = labels.summaryMetricDescriptions.slice(1);
  const summaryDetailSlugs = labels.summaryMetricSlugs.slice(1);
  const summaryDetailValues = summaryRadarDisplayValues.slice(1);
  const summaryDetailRadii = summaryRadarChartRadii.slice(1);
  const summaryDetailTiers = summaryTiers.slice(1);
  const summaryDetailRowFormats = SUM_ROW_FORMATS.slice(1);
  const summaryDetailTrendSeries = summaryMetricTrendSeries.slice(1);

  return (
    <div className={loading ? "opacity-60" : ""}>
      <PageHeader title={pageTitle} subtitle={pageSubtitle} />

      <section className="mb-10">
        <TuringSectionTitle title="Velocity" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <VelocityGauge
            variant="processing"
            title="Processing Velocity"
            metricDescription={VELOCITY_METRIC_DESCRIPTIONS.processing}
            value01={demo.processingVelocity01}
          />
          <VelocityGauge
            variant="stt"
            title="STT Velocity"
            metricDescription={VELOCITY_METRIC_DESCRIPTIONS.stt}
            value01={demo.stt.velocityRatio}
          />
          <SummarizationVelocitySlot value={demo.summary.summarizationVelocity01} />
        </div>
      </section>

      <section>
        <TuringSectionTitle title="Detailed Metrics" />
        {detailLayout === "radar" ? (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <HeptagonRadar
              title="STT"
              values={sttDetailValues}
              chartRadii={sttDetailRadii}
              chartLabels={sttDetailChartLabels}
              listLabels={sttDetailListLabels}
              metricDescriptions={sttDetailDescriptions}
              tiers={sttDetailTiers}
              rowFormats={sttDetailRowFormats}
            />
            <HeptagonRadar
              title={labels.summarySectionTitle}
              values={summaryDetailValues}
              chartRadii={summaryDetailRadii}
              chartLabels={summaryDetailChartLabels}
              listLabels={summaryDetailListLabels}
              metricDescriptions={summaryDetailDescriptions}
              tiers={summaryDetailTiers}
              rowFormats={summaryDetailRowFormats}
            />
          </div>
        ) : domain === "hippo" ? (
          // hippo 도메인 — main 브랜치 시절 카드 레이아웃(STT/Summary 두 컬럼 스택).
          // CS 특화 5종(KCR/IDR/AC/RRS/CSR Turn)은 의료 도메인에 해당 없으므로 노출하지 않는다.
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <TuringMetricsStack
              heading="STT"
              metaPrefix="STT"
              slugs={sttDetailSlugs}
              listLabels={sttDetailListLabels}
              descriptions={sttDetailDescriptions}
              legendSource="stt"
              values={sttDetailValues}
              tiers={sttDetailTiers}
              rowFormats={sttDetailRowFormats}
              trendSeriesByMetric={sttDetailTrendSeries}
            />
            <TuringMetricsStack
              heading={labels.summarySectionTitle}
              metaPrefix="SUMMARY"
              slugs={summaryDetailSlugs}
              listLabels={summaryDetailListLabels}
              descriptions={summaryDetailDescriptions}
              legendSource="summary"
              values={summaryDetailValues}
              tiers={summaryDetailTiers}
              rowFormats={summaryDetailRowFormats}
              trendSeriesByMetric={summaryDetailTrendSeries}
            />
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50/70 px-3 py-2 text-xs text-brand-navy">
              <span
                className="h-3 w-3 shrink-0 rounded-sm bg-sky-200 ring-1 ring-sky-300"
                aria-hidden
              />
              <span>
                하늘색으로 표시된 항목은{" "}
                <strong className="font-semibold text-sky-700">
                  CS 도메인 특화 지표
                </strong>
                입니다.
              </span>
            </div>
            <TuringMetricGrid items={csDetailItems} />
          </>
        )}
      </section>

      <section className="mt-10">
        <TuringSectionTitle title="Trend" />
        <TuringLineChart
          title="Health Score Trend"
          series={trendByCase}
        />
      </section>

      {recentItems.length > 0 && (
        <section className="mt-10">
          <TuringSectionTitle title="최근 평가" />
          <div className="admin-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-line text-left text-xs uppercase tracking-wide text-brand-slate">
                  <th className="px-4 py-2.5 font-medium">Job ID</th>
                  <th className="px-4 py-2.5 font-medium">카테고리</th>
                  <th className="px-4 py-2.5 font-medium">오디오</th>
                  <th className="px-4 py-2.5 font-medium">생성 시각</th>
                  <th className="px-4 py-2.5 font-medium" aria-label="상세" />
                </tr>
              </thead>
              <tbody>
                {recentItems.map((it) => (
                  <tr
                    key={it.id}
                    className="border-b border-brand-line/60 last:border-0 hover:bg-brand-surface/60"
                  >
                    <td className="px-4 py-2.5">
                      <Link
                        to={`/turing/${it.id}`}
                        className="font-mono text-xs text-brand-navy hover:underline"
                      >
                        {it.job_id}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-brand-ink">
                      {it.specialty ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-brand-ink">
                      {it.audio_filename ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-brand-slate">
                      {formatTrendTimeLabel(it.created_at).full}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link
                        to={`/turing/${it.id}`}
                        className="text-xs font-medium text-brand-navy hover:underline"
                      >
                        상세 →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
