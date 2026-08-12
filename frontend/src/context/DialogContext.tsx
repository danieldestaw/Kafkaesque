import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

type DialogState = {
  commandPalette: boolean
  createTopic: boolean
  addCluster: boolean
  produceMessage: boolean
  produceTopic?: string
}

type DialogContextValue = {
  dialogs: DialogState
  openCommandPalette: () => void
  closeCommandPalette: () => void
  openCreateTopic: () => void
  closeCreateTopic: () => void
  openAddCluster: () => void
  closeAddCluster: () => void
  openProduceMessage: (topic?: string) => void
  closeProduceMessage: () => void
}

const defaultState: DialogState = {
  commandPalette: false,
  createTopic: false,
  addCluster: false,
  produceMessage: false,
}

const DialogContext = createContext<DialogContextValue | null>(null)

export function DialogProvider({ children }: { children: ReactNode }) {
  const [dialogs, setDialogs] = useState<DialogState>(defaultState)

  const patch = useCallback((p: Partial<DialogState>) => {
    setDialogs((d) => ({ ...d, ...p }))
  }, [])

  const value: DialogContextValue = {
    dialogs,
    openCommandPalette: () => patch({ commandPalette: true }),
    closeCommandPalette: () => patch({ commandPalette: false }),
    openCreateTopic: () => patch({ createTopic: true }),
    closeCreateTopic: () => patch({ createTopic: false }),
    openAddCluster: () => patch({ addCluster: true }),
    closeAddCluster: () => patch({ addCluster: false }),
    openProduceMessage: (topic) => patch({ produceMessage: true, produceTopic: topic }),
    closeProduceMessage: () => patch({ produceMessage: false, produceTopic: undefined }),
  }

  return <DialogContext.Provider value={value}>{children}</DialogContext.Provider>
}

export function useDialogs() {
  const ctx = useContext(DialogContext)
  if (!ctx) throw new Error('useDialogs must be used within DialogProvider')
  return ctx
}
