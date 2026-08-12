import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Layers,
  MessageSquarePlus,
  Plus,
  Search,
  Server,
  Users,
  LayoutDashboard,
  FileText,
  Network,
} from 'lucide-react'
import { createPortal } from 'react-dom'
import { api, type SearchResult } from '../api/client'
import { useDialogs } from '../context/DialogContext'
import { useDebounce } from '../hooks/useDebounce'
import { cn } from '../lib/cn'

const RECENT_KEY = 'kq_recent_searches'

type PaletteItem = {
  id: string
  label: string
  group: string
  icon: typeof Search
  action: () => void
}

type Props = {
  open: boolean
  onClose: () => void
  clusterId: string
  onClusterChange: (id: string) => void
}

const typeLabels: Record<string, string> = {
  cluster: 'Clusters',
  topic: 'Topics',
  consumer_group: 'Consumer Groups',
  broker: 'Brokers',
}

const typeIcons: Record<string, typeof Search> = {
  cluster: Server,
  topic: Layers,
  consumer_group: Users,
  broker: Network,
}

function loadRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
  } catch {
    return []
  }
}

function saveRecent(q: string) {
  if (!q.trim()) return
  const recent = loadRecent().filter((r) => r !== q)
  recent.unshift(q)
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, 5)))
}

export function CommandPalette({ open, onClose, clusterId, onClusterChange }: Props) {
  const navigate = useNavigate()
  const { openCreateTopic, openAddCluster, openProduceMessage } = useDialogs()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounced = useDebounce(query, 250)

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['search', debounced, clusterId],
    queryFn: () => api.search(debounced, clusterId || undefined),
    enabled: open && debounced.length > 0,
  })

  const navigateToResult = useCallback(
    (r: SearchResult) => {
      saveRecent(debounced)
      if (r.cluster_id && r.cluster_id !== clusterId) onClusterChange(r.cluster_id)
      switch (r.type) {
        case 'cluster':
          navigate('/clusters')
          break
        case 'topic':
          navigate(`/messages?topic=${encodeURIComponent(r.label)}`)
          break
        case 'consumer_group':
          navigate(`/consumers?group=${encodeURIComponent(r.label)}`)
          break
        case 'broker':
          navigate(`/brokers?broker=${encodeURIComponent(r.id)}`)
          break
      }
      onClose()
      setQuery('')
    },
    [clusterId, debounced, navigate, onClose, onClusterChange],
  )

  const staticItems: PaletteItem[] = [
    { id: 'nav-dash', label: 'Go to Dashboard', group: 'Navigation', icon: LayoutDashboard, action: () => { navigate('/'); onClose() } },
    { id: 'nav-topics', label: 'Go to Topics', group: 'Navigation', icon: Layers, action: () => { navigate('/topics'); onClose() } },
    { id: 'nav-consumers', label: 'Go to Consumers', group: 'Navigation', icon: Users, action: () => { navigate('/consumers'); onClose() } },
    { id: 'nav-brokers', label: 'Go to Brokers', group: 'Navigation', icon: Network, action: () => { navigate('/brokers'); onClose() } },
    { id: 'nav-clusters', label: 'Go to Clusters', group: 'Navigation', icon: Server, action: () => { navigate('/clusters'); onClose() } },
    { id: 'nav-audit', label: 'Go to Audit Log', group: 'Navigation', icon: FileText, action: () => { navigate('/audit'); onClose() } },
    { id: 'act-topic', label: 'Create Topic', group: 'Actions', icon: Plus, action: () => { openCreateTopic(); onClose() } },
    { id: 'act-produce', label: 'Produce Message', group: 'Actions', icon: MessageSquarePlus, action: () => { openProduceMessage(); onClose() } },
    { id: 'act-cluster', label: 'Add Cluster', group: 'Actions', icon: Server, action: () => { openAddCluster(); onClose() } },
  ]

  const searchResults: PaletteItem[] = (data?.items || []).map((r) => ({
    id: `${r.type}-${r.id}-${r.cluster_id}`,
    label: r.label,
    group: typeLabels[r.type] || r.type,
    icon: typeIcons[r.type] || Search,
    action: () => navigateToResult(r),
  }))

  const filteredStatic =
    query.length === 0
      ? staticItems
      : staticItems.filter((i) => i.label.toLowerCase().includes(query.toLowerCase()))

  const items = debounced.length > 0 ? searchResults : filteredStatic
  const grouped = items.reduce<Record<string, PaletteItem[]>>((acc, item) => {
    ;(acc[item.group] ||= []).push(item)
    return acc
  }, {})

  const flatItems = Object.values(grouped).flat()

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelected(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    setSelected(0)
  }, [query, debounced])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelected((s) => Math.min(s + 1, flatItems.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelected((s) => Math.max(s - 1, 0))
      } else if (e.key === 'Enter' && flatItems[selected]) {
        e.preventDefault()
        flatItems[selected].action()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, flatItems, selected, onClose])

  if (!open) return null

  const recent = loadRecent()

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh] px-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-xl rounded-xl border border-sf-border bg-sf-panel shadow-2xl animate-scale-in overflow-hidden">
        <div className="flex items-center gap-3 border-b border-sf-border px-4">
          <Search className="h-4 w-4 text-sf-muted shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Kafkaesque…"
            className="flex-1 bg-transparent py-3.5 text-sm focus:outline-none"
            aria-label="Search"
            autoComplete="off"
          />
          <kbd className="hidden sm:inline text-xs text-sf-muted border border-sf-border rounded px-1.5 py-0.5">Esc</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto py-2">
          {isLoading && debounced.length > 0 && (
            <p className="px-4 py-6 text-sm text-sf-muted text-center">Searching…</p>
          )}
          {isError && (
            <p className="px-4 py-6 text-sm text-red-500 text-center">{(error as Error).message}</p>
          )}
          {!isLoading && debounced.length > 0 && searchResults.length === 0 && !isError && (
            <p className="px-4 py-6 text-sm text-sf-muted text-center">No results for "{debounced}"</p>
          )}
          {query.length === 0 && recent.length > 0 && (
            <div className="px-2 pb-2">
              <p className="px-2 py-1 text-xs font-medium text-sf-muted uppercase tracking-wide">Recent</p>
              {recent.map((r) => (
                <button
                  key={r}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-sf-accent/10 transition-colors"
                  onClick={() => setQuery(r)}
                >
                  {r}
                </button>
              ))}
            </div>
          )}
          {Object.entries(grouped).map(([group, groupItems]) => (
            <div key={group}>
              <p className="px-4 py-1.5 text-xs font-medium text-sf-muted uppercase tracking-wide">{group}</p>
              {groupItems.map((item) => {
                const idx = flatItems.indexOf(item)
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={item.action}
                    onMouseEnter={() => setSelected(idx)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors',
                      selected === idx ? 'bg-sf-accent/10 text-sf-accent' : 'hover:bg-sf-border/30',
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0 opacity-70" />
                    <span className="truncate">{item.label}</span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  )
}
