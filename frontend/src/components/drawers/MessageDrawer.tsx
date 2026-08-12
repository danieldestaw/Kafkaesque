import { useState } from 'react'
import { Drawer } from '../ui/Drawer'

type Message = {
  topic?: string
  partition?: number
  offset?: number
  timestamp?: string
  key?: string
  value?: string
  headers?: Record<string, string>
}

type Props = {
  open: boolean
  onClose: () => void
  message: Message | null
}

export function MessageDrawer({ open, onClose, message }: Props) {
  const [tab, setTab] = useState<'formatted' | 'raw'>('formatted')
  if (!message) return null

  const formatted =
    tab === 'formatted'
      ? (() => {
          try {
            return JSON.stringify(JSON.parse(message.value || ''), null, 2)
          } catch {
            return message.value || ''
          }
        })()
      : message.value || ''

  return (
    <Drawer open={open} onClose={onClose} title="Message" width="xl">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm mb-6">
        <div>
          <dt className="text-sf-muted text-xs">Partition</dt>
          <dd className="font-mono mt-0.5">{message.partition}</dd>
        </div>
        <div>
          <dt className="text-sf-muted text-xs">Offset</dt>
          <dd className="font-mono mt-0.5">{message.offset}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-sf-muted text-xs">Timestamp</dt>
          <dd className="font-mono mt-0.5 text-xs">{message.timestamp}</dd>
        </div>
        {message.key && (
          <div className="col-span-2">
            <dt className="text-sf-muted text-xs">Key</dt>
            <dd className="font-mono mt-0.5 text-xs break-all">{message.key}</dd>
          </div>
        )}
      </dl>

      <div className="flex gap-2 mb-3">
        <button
          type="button"
          onClick={() => setTab('formatted')}
          className={`text-xs px-2 py-1 rounded ${tab === 'formatted' ? 'bg-sf-accent/10 text-sf-accent' : 'text-sf-muted'}`}
        >
          JSON
        </button>
        <button
          type="button"
          onClick={() => setTab('raw')}
          className={`text-xs px-2 py-1 rounded ${tab === 'raw' ? 'bg-sf-accent/10 text-sf-accent' : 'text-sf-muted'}`}
        >
          Raw
        </button>
      </div>

      <div className="rounded-lg border border-sf-border overflow-hidden">
        <pre className="p-4 text-xs font-mono overflow-auto max-h-96 whitespace-pre-wrap break-all bg-sf-bg">
          {formatted}
        </pre>
      </div>

      {message.headers && Object.keys(message.headers).length > 0 && (
        <div className="mt-6">
          <h3 className="text-xs font-medium text-sf-muted uppercase tracking-wide mb-2">Headers</h3>
          <dl className="space-y-2">
            {Object.entries(message.headers).map(([k, v]) => (
              <div key={k} className="flex gap-2 text-xs font-mono">
                <dt className="text-sf-muted shrink-0">{k}:</dt>
                <dd className="break-all">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </Drawer>
  )
}
