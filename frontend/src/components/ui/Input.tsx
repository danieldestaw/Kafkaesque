import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

type Props = InputHTMLAttributes<HTMLInputElement> & { error?: boolean }

export const Input = forwardRef<HTMLInputElement, Props>(({ className, error, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'w-full rounded-md border bg-sf-panel px-3 py-2 text-sm transition-colors',
      'placeholder:text-sf-muted focus:outline-none focus:ring-2 focus:ring-sf-accent/40 focus:border-sf-accent',
      error ? 'border-red-500' : 'border-sf-border',
      className,
    )}
    {...props}
  />
))
Input.displayName = 'Input'
