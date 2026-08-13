import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

type Props = InputHTMLAttributes<HTMLInputElement> & { error?: boolean }

export const Input = forwardRef<HTMLInputElement, Props>(({ className, error, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'w-full rounded-lg border-0 bg-sf-input px-3.5 py-2.5 text-sm transition-colors',
      'placeholder:text-sf-muted focus:outline-none focus:ring-2 focus:ring-sf-primary/35',
      error && 'ring-2 ring-red-500',
      className,
    )}
    {...props}
  />
))
Input.displayName = 'Input'
