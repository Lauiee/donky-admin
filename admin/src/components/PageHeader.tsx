import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
  /** "gradient"(기본, 기존 카드형 헤더) | "flat"(Figma 대시보드 디자인 — 테두리만 있는 단순 헤더) */
  variant?: "gradient" | "flat";
};

export function PageHeader({
  title,
  subtitle,
  actions,
  className = "",
  variant = "gradient",
}: PageHeaderProps) {
  if (variant === "flat") {
    return (
      <div
        className={`-mx-4 -mt-6 mb-0 flex flex-col gap-3 border-b border-[#eaecf3] bg-white px-4 py-4 sm:-mx-6 sm:-mt-8 sm:flex-row sm:items-center sm:gap-4 sm:px-8 sm:py-5 lg:-mx-8 ${className}`}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
          <h2 className="shrink-0 whitespace-nowrap text-[18px] font-bold leading-6 tracking-[-0.02em] text-black sm:text-[20px]">
            {title}
          </h2>
          {subtitle ? (
            <p className="min-w-0 text-[12px] leading-4 tracking-[-0.02em] text-[#56607a] sm:flex-1">
              {subtitle}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-3 sm:gap-4">
            {actions}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={`admin-card relative mb-8 flex flex-col gap-5 overflow-hidden p-6 sm:flex-row sm:items-start sm:justify-between sm:p-8 ${className}`}
    >
      <div
        className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-gradient-to-br from-brand-violet/[0.14] to-transparent blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-24 -left-16 h-48 w-48 rounded-full bg-gradient-to-tr from-brand-accent/[0.12] to-transparent blur-3xl"
        aria-hidden
      />
      <div className="relative z-10 min-w-0">
        <h2 className="admin-page-title mb-1.5">{title}</h2>
        {subtitle ? (
          <p className="max-w-2xl text-sm leading-relaxed text-brand-slate">
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="relative z-10 flex flex-wrap items-center gap-3 shrink-0">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
