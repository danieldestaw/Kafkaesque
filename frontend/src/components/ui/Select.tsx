import { forwardRef, type SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../lib/cn'

type Props = SelectHTMLAttributes<HTMLSelectElement> & { error?: boolean }

export const Select = forwardRef<HTMLSelectElement, Props>(({ className, error, children, ...props }, ref) => (
  <div className={cn('relative', className)}>
    <select
      ref={ref}
      className={cn(
        'w-full appearance-none rounded-md border bg-sf-panel px-3 py-2 pr-9 text-sm transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-sf-accent/40 focus:border-sf-accent',
        error ? 'border-red-500' : 'border-sf-border',
        className,
      )}
      {...props}
    >
      {children}
    </select>
    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-sf-muted" />
  </div>
))
Select.displayName = 'Select'
