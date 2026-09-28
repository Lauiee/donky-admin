type SegmentedOption<T extends string> = { value: T; label: string };

type SegmentedControlProps<T extends string> = {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (v: T) => void;
  /** 모달/카드 내부에서 클릭 전파 차단 */
  stopPropagation?: boolean;
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  stopPropagation = false,
}: SegmentedControlProps<T>) {
  return (
    <div
      className="inline-flex gap-0.5 rounded-lg border border-[#eaecf3] bg-white p-0.5"
      role="tablist"
      onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={value === opt.value}
          className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors ${
            value === opt.value
              ? "bg-[#ebf0ff] text-[#04044a]"
              : "text-[#97a0b8] hover:text-[#56607a]"
          }`}
          onClick={(e) => {
            if (stopPropagation) e.stopPropagation();
            onChange(opt.value);
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
