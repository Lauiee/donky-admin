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
}

type MetricDef = {
  group: AiMetricGroup;
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
    label,
    description,
    read,
    toDisplay: (raw) => Math.round(raw * 1000) / 10,
    toGrade: (raw) => gradeMetricBySlug(slug, raw),
  };
}

function velocityDef(
  group: AiMetricGroup,
  label: string,
  description: string,
  read: (m: MetricsApi) => number | null,
  toGrade: (v: number) => MetricTier
): MetricDef {
  return {
    group,
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
    "전체 처리 속도",
    "음성 입력부터 요약 산출까지의 정규화 속도",
    (m) => m.processing_velocity,
    gradeProcessingVelocity
  ),
  velocityDef(
    "PERFORMANCE",
    "STT 처리 속도",
    "STT 처리 속도",
    (m) => m.stt.stt_velocity,
    gradeSttVelocityRatio
  ),
  velocityDef(
    "PERFORMANCE",
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
 * @param metrics 이 요청(job) 하나의 평가 결과 — 카드 값·등급에 씀.
 * @param trendItems 같은 계정(cnt/hippo)의 최근 평가 목록(시간순 무관하게 넘겨도 됨,
 *   내부에서 오래된 순으로 정렬) — 카드 추이선에 씀. 생략 시 추이선 없이 평평한 기준선.
 */
export function buildAiMetricCards(
  metrics: MetricsApi,
  trendItems?: EvaluationListItemApi[]
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
      label: def.label,
      description: def.description,
      value: def.toDisplay(raw),
      grade: def.toGrade(raw),
      series,
    };
    return [card];
  });
}
