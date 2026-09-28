import { useLayoutEffect, useMemo, useRef, useState } from "react";

export type DailyCountPoint = { date: string; count: number };

/** 좌우 패딩 동일 — 라벨 열과 선 끝점이 시각적으로 맞도록 */
const VB = { W: 1000, H: 340, padL: 36, padR: 36, padT: 24, padB: 52 };

/**
 * Catmull-Rom → Cubic Bezier — 점들을 지나는 부드러운 곡선.
 * Figma 목업 차트가 꺾은선이 아니라 부드러운 곡선이라, 실제 데이터로 그릴 때도
 * 같은 느낌을 내기 위해 직선(M/L) 대신 이 보간을 씀.
 */
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

function buildPaths(data: DailyCountPoint[]) {
  const n = data.length;
  if (n === 0) {
    return {
      lineD: "",
      areaD: "",
      points: [] as {
        x: number;
        y: number;
        date: string;
        count: number;
      }[],
      max: 1,
    };
  }
  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const { W, H, padL, padR, padT, padB } = VB;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const baseY = padT + innerH;

  const xs = data.map((_, i) =>
    n === 1 ? padL + innerW / 2 : padL + (i / (n - 1)) * innerW
  );
  const ys = data.map((d) => {
    const t = d.count / maxCount;
    return padT + innerH * (1 - t);
  });

  const points = data.map((d, i) => ({
    x: xs[i],
    y: ys[i],
    date: d.date,
    count: d.count,
  }));

  const lineD = smoothPathD(points);

  const areaD =
    points.length > 0
      ? `M ${points[0].x} ${baseY} L ${points[0].x} ${points[0].y} ${smoothPathD(
          points
        ).replace(/^M[^C]*/, "")} L ${points[points.length - 1].x} ${baseY} Z`
      : "";

  return { lineD, areaD, points, max: maxCount };
}

export function DashboardLineChart({ data }: { data: DailyCountPoint[] }) {
  const lineRef = useRef<SVGPathElement>(null);
  const areaRef = useRef<SVGPathElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const { lineD, areaD, points, max } = useMemo(() => buildPaths(data), [data]);

  useLayoutEffect(() => {
    const path = lineRef.current;
    if (!path || !lineD) return;
    const len = path.getTotalLength();
    path.style.strokeDasharray = `${len}`;
    path.style.strokeDashoffset = `${len}`;
    path.style.transition = "none";
    const id = requestAnimationFrame(() => {
      path.style.transition =
        "stroke-dashoffset 1.15s cubic-bezier(0.22, 1, 0.36, 1)";
      path.style.strokeDashoffset = "0";
    });
    return () => cancelAnimationFrame(id);
  }, [lineD]);

  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.opacity = "0";
    el.style.transition = "none";
    requestAnimationFrame(() => {
      el.style.transition = "opacity 0.85s ease 0.15s";
      el.style.opacity = "1";
    });
  }, [areaD]);

  const pickIndex = (svgX: number) => {
    if (points.length === 0) return 0;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < points.length; i++) {
      const d = Math.abs(points[i].x - svgX);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  };

  const onPointer = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg || points.length === 0) return;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const cur = pt.matrixTransform(ctm.inverse());
    const i = pickIndex(cur.x);
    setHoverIndex(i);
  };

  if (data.length === 0) return null;

  const active =
    hoverIndex != null && points[hoverIndex] ? points[hoverIndex] : null;

  return (
    <div className="w-full select-none">
      {/* 차트만 감싸 % 좌표 = viewBox와 1:1 (fixed/CTM 불일치 방지) */}
      <div className="relative w-full">
      {/* viewBox 비율 = 표시 비율 (w-full + h-auto) → meet 시 가로·세로 레터박스 없음, 라인이 첫/끝 날짜까지 맞음 */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB.W} ${VB.H}`}
        className="block h-auto w-full max-w-full touch-none"
        style={{ aspectRatio: `${VB.W} / ${VB.H}` }}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="최근 일별 요청량 라인 차트"
        onPointerLeave={() => setHoverIndex(null)}
        onPointerMove={(e) => {
          if (e.pointerType === "mouse" || e.pointerType === "pen") {
            onPointer(e.clientX, e.clientY);
          }
        }}
        onPointerEnter={(e) => onPointer(e.clientX, e.clientY)}
        onPointerDown={(e) => onPointer(e.clientX, e.clientY)}
      >
        <defs>
          {/* Figma 원본과 동일한 세로 그라데이션 — 위(진한 틸) → 아래(20% 틸) */}
          <linearGradient id="dashboardAreaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#40E0D0" stopOpacity={1} />
            <stop offset="100%" stopColor="#40E0D0" stopOpacity={0.2} />
          </linearGradient>
        </defs>

        {/* faint grid */}
        {[0.25, 0.5, 0.75].map((t) => {
          const y = VB.padT + (VB.H - VB.padT - VB.padB) * (1 - t);
          return (
            <line
              key={t}
              x1={VB.padL}
              y1={y}
              x2={VB.W - VB.padR}
              y2={y}
              stroke="currentColor"
              strokeOpacity={0.06}
              strokeWidth={1}
              className="text-brand-navy"
            />
          );
        })}

        <path
          ref={areaRef}
          d={areaD}
          fill="url(#dashboardAreaFill)"
        />

        <path
          ref={lineRef}
          d={lineD}
          fill="none"
          stroke="#40E0D0"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {points.map((p, i) => {
          const isH = hoverIndex === i;
          return (
            <g key={p.date}>
              <circle
                cx={p.x}
                cy={p.y}
                r={isH ? 9 : 6}
                fill="white"
                stroke="#40E0D0"
                strokeWidth={isH ? 2.5 : 2}
                className="transition-all duration-200 ease-out"
              />
              <circle
                cx={p.x}
                cy={p.y}
                r={isH ? 3.5 : 2.5}
                fill="#40E0D0"
                className="pointer-events-none transition-all duration-200"
              />
            </g>
          );
        })}

        {hoverIndex != null && points[hoverIndex] && (
          <line
            x1={points[hoverIndex].x}
            y1={VB.padT}
            x2={points[hoverIndex].x}
            y2={VB.H - VB.padB}
            stroke="#40E0D0"
            strokeOpacity={0.35}
            strokeWidth={1.5}
            strokeDasharray="4 6"
          />
        )}
      </svg>

      {active && hoverIndex != null && points[hoverIndex] && (
        <div
          className="pointer-events-none absolute z-40 min-w-[9rem] rounded-lg border border-brand-line bg-white px-3 py-2 text-xs shadow-md"
          style={{
            left: `${(points[hoverIndex].x / VB.W) * 100}%`,
            top: `${(points[hoverIndex].y / VB.H) * 100}%`,
            transform: "translate(-50%, calc(-100% - 10px))",
          }}
        >
          <div className="font-bold text-brand-ink">
            요청량{" "}
            <span className="tabular-nums text-brand-navy">{active.count}</span>
            건
          </div>
          <div className="mt-0.5 text-[11px] text-brand-slate">
            {active.date.replace(/-/g, ".")}
          </div>
          <div className="mt-1 text-[10px] text-brand-mint">
            최대 대비 {max > 0 ? Math.round((active.count / max) * 100) : 0}%
          </div>
        </div>
      )}
      </div>

      {/* compact x labels — same spacing as chart (full width, no huge gaps) */}
      <div className="mt-1 flex w-full justify-between gap-0 px-1 sm:px-0">
        {points.map((p) => (
          <div
            key={p.date}
            className="min-w-0 flex-1 text-center"
          >
            <div className="text-[10px] font-semibold tabular-nums text-brand-navy sm:text-xs">
              {p.count}
            </div>
            <div className="text-[9px] font-medium text-brand-slate sm:text-[10px]">
              {p.date.slice(5).replace("-", "/")}
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
