import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

type Props = {
  children: ReactNode
  className?: string
  padding?: 'none' | 'sm' | 'md'
}

const paddingClass = {
  none: '',
  sm: 'p-3',
  md: 'p-5',
}

/** Standard panel card used across pages. */
export function Card({ children, className, padding = 'md' }: Props) {
  return (
    <div
      className={cn(
        'rounded-xl border border-sf-border bg-sf-panel shadow-sm',
        paddingClass[padding],
        className,
      )}
    >
      {children}
    </div>
  )
}
