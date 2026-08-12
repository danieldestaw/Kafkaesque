import { useMemo, useRef } from 'react'
import { Copy, RotateCcw, Sparkles } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Button } from './Button'

type Props = {
  value: string
  onChange: (value: string) => void
  error?: string
  rows?: number
}

export function CodeEditor({ value, onChange, error, rows = 12 }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lineCount = value.split('\n').length
  const lines = useMemo(() => Array.from({ length: Math.max(lineCount, rows) }, (_, i) => i + 1), [lineCount, rows])

  const format = () => {
    try {
      onChange(JSON.stringify(JSON.parse(value), null, 2))
    } catch {
      /* invalid json */
    }
  }

  const copy = async () => {
    await navigator.clipboard.writeText(value)
  }

  const clear = () => onChange('')

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        <Button type="button" variant="ghost" size="sm" onClick={format}>
          <Sparkles className="h-3.5 w-3.5" /> Format
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={copy}>
          <Copy className="h-3.5 w-3.5" /> Copy
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={clear}>
          <RotateCcw className="h-3.5 w-3.5" /> Clear
        </Button>
      </div>
      <div
        className={cn(
          'relative overflow-hidden rounded-lg border font-mono text-sm',
          error ? 'border-red-500' : 'border-sf-border',
        )}
      >
        <div className="flex">
          <div className="select-none border-r border-sf-border bg-sf-bg px-3 py-2 text-right text-xs text-sf-muted leading-6">
            {lines.map((n) => (
              <div key={n}>{n}</div>
            ))}
          </div>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            spellCheck={false}
            className="min-h-[200px] flex-1 resize-y bg-sf-panel px-3 py-2 leading-6 focus:outline-none"
            rows={rows}
          />
        </div>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
