import type { ProjectItem } from "../api";
import iconChevron from "../assets/dashboard/icon2.svg";
import iconDivider from "../assets/dashboard/line2.svg";

interface ProjectSelectProps {
  value: string;
  onChange: (value: string) => void;
  projects: ProjectItem[];
  placeholder?: string;
  className?: string;
  /** "pill"(기본, 기존 스타일) | "flat"(Figma 대시보드 디자인) */
  variant?: "pill" | "flat";
}

const ProjectIcon = ({ active }: { active?: boolean }) => (
  <svg
    className={`w-4 h-4 shrink-0 ${
      active ? "text-brand-accentDark" : "text-brand-mint"
    }`}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
    />
  </svg>
);

export function ProjectSelect({
  value,
  onChange,
  projects,
  placeholder = "전체 프로젝트",
  className = "",
  variant = "pill",
}: ProjectSelectProps) {
  if (projects.length === 0) return null;

  const hasSelection = Boolean(value);

  if (variant === "flat") {
    const selectedLabel =
      projects.find((p) => p.id === value)?.name ?? placeholder;
    return (
      <div
        className={`inline-flex h-[34px] items-center gap-2 rounded-lg border border-[#d4d8e8] bg-white px-3 py-1.5 ${className}`}
      >
        <span className="whitespace-nowrap text-[12px] leading-4 text-[#39435a]">
          프로젝트
        </span>
        <img src={iconDivider} alt="" className="h-3 w-px" />
        <span className="relative whitespace-nowrap text-[12px] font-medium leading-4 text-black">
          {selectedLabel}
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label={placeholder}
          >
            <option value="">{placeholder}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </span>
        <img src={iconChevron} alt="" className="h-5 w-5" />
      </div>
    );
  }

  return (
    <div
      className={`
        inline-flex items-center gap-2.5 pl-3 pr-2 py-2 rounded-xl
        border transition-all min-w-[160px]
        ${
          hasSelection
            ? "border-brand-accent/50 bg-brand-accent/10"
            : "border-brand-line bg-white hover:border-brand-mint/50"
        }
        focus-within:ring-2 focus-within:ring-brand-accent/30 focus-within:border-brand-accent
        shadow-sm hover:shadow-admin-card
        ${className}
      `}
    >
      <ProjectIcon active={hasSelection} />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="
          appearance-none bg-transparent border-none outline-none
          text-sm font-medium min-w-0 flex-1 cursor-pointer
          focus:ring-0 py-0.5 pr-5
          text-brand-navy
        "
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%235B6B95'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 0 center",
          backgroundSize: "1rem",
        }}
      >
        <option value="">{placeholder}</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </div>
  );
}
