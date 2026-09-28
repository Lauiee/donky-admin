import type { EvaluationListItemApi, MetricsApi } from "./turingApi";
import {
  gradeMetricBySlug,
  gradeProcessingVelocity,
  gradeSttVelocityRatio,
  gradeSummarizationVelocity,
  velocityRawToDisplayScorePct,
  type MetricTier,
} from "./metricGrades";

export type AiMetricGroup = "PERFORMANCE" | "STT" | "SUMMARY";

export interface AiMetricSeriesPoint {
  label: string;
  value: number;
}

export interface AiMetricCardData {
  group: AiMetricGroup;
  slug: string;
  label: string;
  description: string;
  /** 0~100 표시값 */
  value: number;
  grade: MetricTier;
  /**
   * 최근 평가 추이(0~100, 시간순). 이 계정(cnt/hippo)의 최근 평가 목록에서 뽑음 —
   * Turing API가 "프로젝트" 단위 필터를 지원하지 않아 계정 전체 최근 건수 기준.
   * 2건 미만이면 undefined — 카드 쪽에서 평평한 기준선으로 대체 표시.
   */
  series?: AiMetricSeriesPoint[];
  /** CS(상담) 도메인 특화 지표 강조 — buildAiMetricCards의 highlightDomainSpecific 참고 */
  highlight?: boolean;
}

/**
 * 구 Turing 디자인에서 하늘색으로 강조하던 "CS 도메인 특화 지표" slug 중,
 * 실제 Turing 평가 API가 값을 주는 것만 골랐음. (KCR/IDR/AC/RRS/CSR_TURN은
 * API에 없는 목업 전용 지표라 이 카드 세트에는 애초에 없어 제외)
 */
const DOMAIN_SPECIAL_SLUGS = new Set(["CKM", "CKD", "CIR"]);

type MetricDef = {
  group: AiMetricGroup;
  slug: string;
  label: string;
  description: string;
  read: (m: MetricsApi) => number | null;
  toDisplay: (raw: number) => number;
  toGrade: (raw: number) => MetricTier;
};

function ratioDef(
  group: AiMetricGroup,
  label: string,
  description: string,
  slug: string,
  read: (m: MetricsApi) => number | null
): MetricDef {
  return {
    group,
    slug,
    label,
    description,
    read,
    toDisplay: (raw) => Math.round(raw * 1000) / 10,
    toGrade: (raw) => gradeMetricBySlug(slug, raw),
  };
}

function velocityDef(
  group: AiMetricGroup,
  slug: string,
  label: string,
  description: string,
  read: (m: MetricsApi) => number | null,
  toGrade: (v: number) => MetricTier
): MetricDef {
  return {
    group,
    slug,
    label,
    description,
    read,
    toDisplay: velocityRawToDisplayScorePct,
    toGrade,
  };
}

/**
 * Figma 목업의 "처리량"·"P95 지연 시간" 카드는 뺐다 — 이 값을 줄 API 필드가
 * 없어서(서버 인프라 모니터링 지표라 Turing 평가 데이터에는 애초에 없음),
 * 실제로 값을 계산할 수 있는 지표만 담았다.
 */
const METRIC_DEFS: MetricDef[] = [
  velocityDef(
    "PERFORMANCE",
    "PROCESSING_VELOCITY",
    "전체 처리 속도",
    "음성 입력부터 요약 산출까지의 정규화 속도",
    (m) => m.processing_velocity,
    gradeProcessingVelocity
  ),
  velocityDef(
    "PERFORMANCE",
    "STT_VELOCITY",
    "STT 처리 속도",
    "STT 처리 속도",
    (m) => m.stt.stt_velocity,
    gradeSttVelocityRatio
  ),
  velocityDef(
    "PERFORMANCE",
    "SUMMARY_VELOCITY",
    "요약 처리 속도",
    "요약 처리 속도",
    (m) => m.summary.summarization_velocity,
    gradeSummarizationVelocity
  ),

  ratioDef(
    "STT",
    "UER (이상 문장 비율)",
    "문법적으로 부자연스럽거나 의미 해석이 불가능한 문장 비율",
    "UER",
    (m) => m.stt.uer
  ),
  ratioDef(
    "STT",
    "개인정보 보호율",
    "개인식별정보(전화/주소/카드/이름 등)를 올바르게 탐지하여 마스킹한 비율",
    "PII_PROTECTION",
    (m) => m.stt.pii_protection
  ),
  ratioDef(
    "STT",
    "CKM (의료 용어 누락율)",
    "전사 과정에서 실제 발화된 CS 도메인 키워드를 인식하지 못한 비율",
    "CKM",
    (m) => m.stt.mmr
  ),
  ratioDef(
    "STT",
    "CKD (의료 용어 왜곡률)",
    "전사 과정에서 CS 도메인 키워드가 잘못된 형태로 출력된 비율",
    "CKD",
    (m) => m.stt.mdr
  ),
  ratioDef(
    "STT",
    "화자 분리 정확도",
    "화자 라벨 및 구간이 정확히 매칭된 세그먼트 비율",
    "DIARIZATION",
    (m) => m.stt.diarization_accuracy
  ),
  ratioDef(
    "STT",
    "단어 반복(중복) 비율",
    "비정상적 반복(모델 오류로 인한 반복) 비율",
    "REDUNDANCY",
    (m) => m.stt.redundancy_ratio
  ),

  ratioDef(
    "SUMMARY",
    "HR (누락/환각 비율)",
    "전사문 대비 의미적 근거를 찾을 수 없는 문장의 비율",
    "HR",
    (m) => m.summary.hallucination_ratio
  ),
  ratioDef(
    "SUMMARY",
    "SSR (의미 보존율)",
    "전사문 대비 핵심 의미를 충실히 유지한 문장의 비율",
    "SSR",
    (m) => m.summary.ssr
  ),
  ratioDef(
    "SUMMARY",
    "ICR (정보 압축률)",
    "전사문 대비 얼마나 정보량을 압축했는지를 나타내는 비율",
    "ICR",
    (m) => m.summary.icr
  ),
  ratioDef(
    "SUMMARY",
    "CKD (요약 용어 왜곡률)",
    "요약 내 CS 핵심정보가 잘못된 형태로 출력된 비율",
    "CKD",
    (m) => m.summary.summary_mdr
  ),
  ratioDef(
    "SUMMARY",
    "CIR (의료 정보 포함률)",
    "전사문 대비 CS 핵심정보의 포함 비율(누락 여부 측정)",
    "CIR",
    (m) => m.summary.mir
  ),
  ratioDef(
    "SUMMARY",
    "SSA (SOAP 배치 정확도)",
    "SOAP(Subjective/Objective/Assessment/Plan) 섹션 배치 정확도",
    "SSA",
    (m) => m.summary.ssa
  ),
];

function shortDateLabel(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (m) return `${m[2]}/${m[3]}`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * @param metrics 카드 값·등급에 쓸 평가 결과 — 단건(요청 상세)이든, 최근 평가
 *   평균(averageMetricsApi 결과, Turing 페이지)이든 형태만 같으면 됨.
 * @param trendItems 같은 계정(cnt/hippo)의 최근 평가 목록(시간순 무관하게 넘겨도 됨,
 *   내부에서 오래된 순으로 정렬) — 카드 추이선에 씀. 생략 시 추이선 없이 평평한 기준선.
 * @param opts.highlightDomainSpecific CS(상담) 도메인 특화 지표(CKM/CKD/CIR) 강조 표시.
 *   Turing 페이지에서 cnt 도메인일 때만 켬 — hippo(의료)엔 해당 없음.
 */
export function buildAiMetricCards(
  metrics: MetricsApi,
  trendItems?: EvaluationListItemApi[],
  opts?: { highlightDomainSpecific?: boolean }
): AiMetricCardData[] {
  const sortedTrend = trendItems?.length
    ? [...trendItems].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
    : undefined;

  return METRIC_DEFS.flatMap((def) => {
    const raw = def.read(metrics);
    if (raw == null) return [];

    let series: AiMetricSeriesPoint[] | undefined;
    if (sortedTrend) {
      const pts = sortedTrend.flatMap((item) => {
        const r = def.read(item.metrics);
        if (r == null) return [];
        return [{ label: shortDateLabel(item.created_at), value: def.toDisplay(r) }];
      });
      if (pts.length >= 2) series = pts;
    }

    const card: AiMetricCardData = {
      group: def.group,
      slug: def.slug,
      label: def.label,
      description: def.description,
      value: def.toDisplay(raw),
      grade: def.toGrade(raw),
      series,
      highlight:
        opts?.highlightDomainSpecific && DOMAIN_SPECIAL_SLUGS.has(def.slug)
          ? true
          : undefined,
    };
    return [card];
  });
}

/**
 * 여러 평가 건의 원시 지표를 단순 평균해 MetricsApi 모양으로 합침.
 * Turing 페이지(계정 전체 최근 평가)처럼 "건별"이 아니라 "최근 추세의 대표값"이
 * 필요할 때 씀 — null 값은 평균에서 제외.
 */
export function averageMetricsApi(items: EvaluationListItemApi[]): MetricsApi | null {
  if (items.length === 0) return null;
  const avg = (vals: (number | null | undefined)[]): number => {
    const nums = vals.filter((v): v is number => v != null && !Number.isNaN(v));
    return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
  };
  const avgOrNull = (vals: (number | null | undefined)[]): number | null => {
    const nums = vals.filter((v): v is number => v != null && !Number.isNaN(v));
    return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
  };
  return {
    processing_velocity: avg(items.map((i) => i.metrics.processing_velocity)),
    stt: {
      stt_velocity: avg(items.map((i) => i.metrics.stt.stt_velocity)),
      uer: avgOrNull(items.map((i) => i.metrics.stt.uer)),
      pii_protection: avgOrNull(items.map((i) => i.metrics.stt.pii_protection)),
      mmr: avgOrNull(items.map((i) => i.metrics.stt.mmr)),
      mdr: avgOrNull(items.map((i) => i.metrics.stt.mdr)),
      diarization_accuracy: avgOrNull(
        items.map((i) => i.metrics.stt.diarization_accuracy)
      ),
      redundancy_ratio: avgOrNull(items.map((i) => i.metrics.stt.redundancy_ratio)),
    },
    summary: {
      summarization_velocity: avgOrNull(
        items.map((i) => i.metrics.summary.summarization_velocity)
      ),
      hallucination_ratio: avgOrNull(
        items.map((i) => i.metrics.summary.hallucination_ratio)
      ),
      ssr: avgOrNull(items.map((i) => i.metrics.summary.ssr)),
      icr: avgOrNull(items.map((i) => i.metrics.summary.icr)),
      mir: avgOrNull(items.map((i) => i.metrics.summary.mir)),
      summary_mdr: avgOrNull(items.map((i) => i.metrics.summary.summary_mdr)),
      ssa: avgOrNull(items.map((i) => i.metrics.summary.ssa)),
    },
  };
}
