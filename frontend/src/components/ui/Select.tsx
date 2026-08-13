import { forwardRef, type SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../lib/cn'

type Props = SelectHTMLAttributes<HTMLSelectElement> & { error?: boolean; wrapperClassName?: string }

export const Select = forwardRef<HTMLSelectElement, Props>(
  ({ className, wrapperClassName, error, children, ...props }, ref) => (
    <div className={cn('relative', wrapperClassName)}>
      <select
        ref={ref}
        className={cn(
          'w-full appearance-none rounded-lg border-0 bg-sf-input px-3.5 py-2.5 pr-9 text-sm transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-sf-primary/35',
          error && 'ring-2 ring-red-500',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-sf-muted" />
    </div>
  ),
)
Select.displayName = 'Select'
