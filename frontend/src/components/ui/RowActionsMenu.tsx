import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { MoreHorizontal } from 'lucide-react'
import { cn } from '../../lib/cn'

export type RowAction = {
  label: string
  onClick: () => void
  destructive?: boolean
  disabled?: boolean
  disabledReason?: string
}

type Props = {
  actions: RowAction[]
  label?: string
}

export function RowActionsMenu({ actions, label = 'Row actions' }: Props) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    document.addEventListener('click', close)
    document.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('click', close)
      document.removeEventListener('scroll', close, true)
    }
  }, [menu])

  if (actions.length === 0) return null

  const openMenu = (e: React.MouseEvent) => {
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setMenu({ x: rect.right - 192, y: rect.bottom + 4 })
  }

  return (
    <>
      <button
        type="button"
        className="rounded-md p-1.5 text-sf-muted transition-colors hover:bg-sf-input hover:text-sf-text"
        onClick={openMenu}
        aria-label={label}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {menu &&
        createPortal(
          <div
            className="fixed z-[100] w-48 rounded-lg border border-sf-border bg-sf-panel py-1 shadow-xl"
            style={{ left: menu.x, top: menu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            {actions.map((a) => (
              <button
                key={a.label}
                type="button"
                disabled={a.disabled}
                title={a.disabled ? a.disabledReason : undefined}
                className={cn(
                  'w-full px-3 py-2 text-left text-sm hover:bg-sf-input disabled:cursor-not-allowed disabled:opacity-50',
                  a.destructive && 'text-red-600 dark:text-red-400',
                )}
                onClick={() => {
                  setMenu(null)
                  a.onClick()
                }}
              >
                {a.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}
