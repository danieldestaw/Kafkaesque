import { useEffect } from 'react'

export function usePageTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `Kafkaesque — ${title}` : 'Kafkaesque'
  }, [title])
}
