import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  loading?: boolean
  size?: 'sm' | 'md'
}

const variants: Record<Variant, string> = {
  primary:
    'bg-sf-accent text-white hover:bg-blue-600 focus-visible:ring-sf-accent/50 shadow-sm',
  secondary:
    'border border-sf-border bg-sf-panel hover:bg-sf-bg focus-visible:ring-sf-accent/30',
  ghost: 'hover:bg-sf-border/40 focus-visible:ring-sf-accent/30',
  danger:
    'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500/50 shadow-sm',
}

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ className, variant = 'primary', loading, size = 'md', disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-sf-bg disabled:opacity-50 disabled:pointer-events-none',
        size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-sm',
        variants[variant],
        className,
      )}
      {...props}
    >
      {loading && (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  ),
)
Button.displayName = 'Button'
