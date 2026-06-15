import { type ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'default' | 'ghost'

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-accent hover:bg-accent-soft text-white border-transparent',
  default: 'bg-surface-raised hover:bg-border text-slate-100 border-border',
  ghost: 'bg-transparent hover:bg-surface-raised text-muted hover:text-slate-100 border-transparent',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
}

export function Button({ variant = 'default', className = '', ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  )
}
