import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getExperimentalStorageSettings, type ExperimentalStorageSettings } from '../api/settings'

export const EXPERIMENTAL_STORAGE_QUERY_KEY = ['experimental-storage-settings'] as const

export function useExperimentalStorageSettings(options?: { enabled?: boolean }) {
  return useQuery<ExperimentalStorageSettings, Error>({
    queryKey: EXPERIMENTAL_STORAGE_QUERY_KEY,
    queryFn: getExperimentalStorageSettings,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
    enabled: options?.enabled ?? true,
  })
}

export function useInvalidateExperimentalStorage() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: EXPERIMENTAL_STORAGE_QUERY_KEY })
}
