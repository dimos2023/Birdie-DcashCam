import { cn } from "@/lib/utils";

interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: { value: string; label: string }[];
  placeholder?: string;
}

export function FormSelect({
  options,
  placeholder,
  className,
  ...props
}: FormSelectProps) {
  return (
    <select
      className={cn(
        "flex h-10 w-full rounded-md border border-[#d4e4f0] bg-white px-3 py-2 text-sm text-[#1C1C1C] shadow-xs outline-none focus:border-[#3B8ECC] focus:ring-2 focus:ring-[#3B8ECC]/20 disabled:opacity-50",
        className
      )}
      {...props}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
