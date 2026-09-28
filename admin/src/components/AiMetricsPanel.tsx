import type { AiMetricCardData, AiMetricGroup } from "../turing/aiMetricCards";
import { AiMetricCard, type AiMetricCardVariant } from "./AiMetricCard";

const VARIANT_BY_NUMBER: Record<string, AiMetricCardVariant> = {
  "1": "sparkline",
  "2": "donut",
  "3": "line",
  "4": "areaBig",
};

/**
 * "AI 성능 지표" 카드 4가지 디자인(Figma 399:11817 / 399:12292 / 399:12797 / 437:25100) 중
 * 어떤 걸 보여줄지 정하는 값. 고객이 화면에서 바꾸는 옵션이 아니라, 배포 시 개발자가
 * 정하는 파라미터 — .env(VITE_AI_METRICS_VARIANT="1"~"4")로 고객사별로 다르게 설정한다.
 * 기본값은 1번(하단 미니 영역 스파크라인).
 */
export function resolveAiMetricCardVariant(): AiMetricCardVariant {
  const raw = (import.meta.env.VITE_AI_METRICS_VARIANT as string | undefined)?.trim();
  return VARIANT_BY_NUMBER[raw ?? "1"] ?? "sparkline";
}

const GROUP_ORDER: AiMetricGroup[] = ["PERFORMANCE", "STT", "SUMMARY"];

export function AiMetricsPanel({
  cards,
  variant,
}: {
  cards: AiMetricCardData[];
  /** 생략하면 resolveAiMetricCardVariant()(.env 파라미터) 값을 씀 */
  variant?: AiMetricCardVariant;
}) {
  const resolved = variant ?? resolveAiMetricCardVariant();

  const groups = GROUP_ORDER.map((g) => ({
    group: g,
    items: cards.filter((c) => c.group === g),
  })).filter((g) => g.items.length > 0);

  if (groups.length === 0) {
    return (
      <div className="rounded-[12px] border border-[#eaecf3] bg-[#fbfcff] p-8 text-center text-sm text-[#56607a]">
        이 요청에 대한 AI 성능 평가 데이터가 없습니다.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.map(({ group, items }) => (
        <div key={group} className="flex flex-col gap-2">
          <div className="flex items-center gap-1">
            <p className="text-[16px] font-bold tracking-[-0.02em] text-black">
              {group}
            </p>
          </div>
          <div className="flex flex-wrap gap-4">
            {items.map((c) => (
              <div key={c.label} className="min-w-[220px] flex-1 basis-[220px]">
                <AiMetricCard data={c} variant={resolved} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
