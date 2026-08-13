import { cn } from '../lib/cn'
import logoUrl from '../assets/kafkaesque-logo.png'

type Props = {
  variant?: 'default' | 'sidebar'
  className?: string
  collapsed?: boolean
}

/** Kafkaesque wordmark — sidebar variant is white for blue sidebar backgrounds. */
export function BrandLogo({ variant = 'default', className, collapsed }: Props) {
  return (
    <img
      src={logoUrl}
      alt="Kafkaesque"
      className={cn(
        'block object-contain object-left',
        variant === 'sidebar' && 'sidebar-logo',
        variant === 'sidebar' &&
          (collapsed ? 'h-10 w-12 object-left' : 'h-14 w-full max-w-[220px]'),
        variant === 'default' && 'h-auto w-full max-w-[240px]',
        className,
      )}
    />
  )
}
