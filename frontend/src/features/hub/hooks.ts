
import { useState, useEffect } from 'react'
import { fetchImageHubAssetStatus, type ImageHubAssetStatus } from '../../shared/api/hub'

export function useDebouncedValue<T>(value: T, delay: number): T {
    const [debounced, setDebounced] = useState(value)
    useEffect(() => {
        const timer = window.setTimeout(() => setDebounced(value), delay)
        return () => window.clearTimeout(timer)
    }, [value, delay])
    return debounced
}

type AssetStatusMap = Map<string, { already_linked: boolean; other_projects: string[] }>

export function useAssetStatuses(assetIds: string[], currentProjectId: string | null) {
    const [statusMap, setStatusMap] = useState<AssetStatusMap>(() => new Map())
    const [version, forceRender] = useState(0)

    useEffect(() => {
        if (!assetIds.length || !currentProjectId) return
        const missing = assetIds.filter((id) => !statusMap.has(id))
        if (!missing.length) return
        let canceled = false

        async function hydrate(next: string[]) {
            for (const assetId of next) {
                if (canceled) break
                try {
                    const status = await fetchImageHubAssetStatus(assetId, currentProjectId)
                    setStatusMap((prev) => {
                        const nextMap = new Map(prev)
                        nextMap.set(assetId, status)
                        return nextMap
                    })
                    forceRender((v) => v + 1)
                } catch (err) {
                    console.error('Failed to load status for ImageHub asset', assetId, err)
                    setStatusMap((prev) => {
                        const nextMap = new Map(prev)
                        nextMap.set(assetId, { already_linked: false, other_projects: [] })
                        return nextMap
                    })
                    forceRender((v) => v + 1)
                }
                // Small delay to yield to UI? No, awaiting fetch is enough yield.
            }
        }

        hydrate(missing)

        return () => {
            canceled = true
        }
    }, [assetIds, currentProjectId, statusMap])

    return [statusMap, version] as const
}
