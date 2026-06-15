import { Icon } from './Icon'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function SearchInput({ value, onChange, placeholder = 'Search…' }: SearchInputProps) {
  return (
    <div className="relative flex-1">
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted">
        <Icon name="search" size={16} />
      </span>
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-border bg-surface py-1.5 pl-8 pr-3 text-sm text-slate-100 placeholder:text-muted focus:border-accent focus:outline-none"
      />
    </div>
  )
}
