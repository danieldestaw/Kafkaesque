import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'

export function useRoles() {
  return useQuery({
    queryKey: ['roles'],
    queryFn: () => api.roles(),
    staleTime: 60_000,
  })
}
