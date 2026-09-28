import type { ReactNode } from "react";

type StatCardProps = {
  label: string;
  headerRight?: ReactNode;
  value: ReactNode;
  unit?: string;
  /** 카드 오른쪽의 장식 이미지 (Figma 일러스트, 76x76) */
  image?: ReactNode;
  footer?: ReactNode;
  className?: string;
  onClick?: () => void;
};

/** Figma "핵심 지표" 카드 — bg #fbfcff, border #eaebf8, rounded-16 */
export function StatCard({
  label,
  headerRight,
  value,
  unit,
  image,
  footer,
  className = "",
  onClick,
}: StatCardProps) {
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      onClick={onClick}
      className={`flex min-w-0 items-start gap-1.5 rounded-[16px] border border-[#eaebf8] bg-[#fbfcff] p-3 transition-shadow sm:gap-2 sm:p-4 ${
        onClick ? "cursor-pointer hover:shadow-md" : ""
      } ${className}`}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1 sm:gap-2">
        <div className="flex w-full flex-wrap items-center gap-1">
          <p className="min-w-0 text-[13px] font-medium leading-5 tracking-[-0.02em] text-black sm:whitespace-nowrap sm:text-[16px]">
            {label}
          </p>
          {headerRight}
        </div>
        <div className="flex items-end gap-1.5 whitespace-nowrap sm:gap-2">
          <p className="text-[28px] font-bold leading-[34px] text-black sm:text-[40px] sm:leading-[48px]">
            {value}
          </p>
          {unit ? (
            <p className="text-[13px] leading-5 tracking-[-0.02em] text-[#97a0b8] sm:text-[16px]">
              {unit}
            </p>
          ) : null}
        </div>
        {footer ? (
          <div className="text-xs text-[#56607a]">{footer}</div>
        ) : null}
      </div>
      {image ? (
        <div className="relative aspect-square h-[48px] w-[48px] shrink-0 overflow-hidden sm:h-[76px] sm:w-[76px]">
          {image}
        </div>
      ) : null}
    </div>
  );
}
