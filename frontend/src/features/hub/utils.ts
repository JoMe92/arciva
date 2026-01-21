
import { useState, useEffect } from 'react'
import type { ImageHubAsset, ImageHubAssetFilters } from '../../shared/api/hub'
import type { HubFilterState, HubTile, ImgType } from './types'

export function createDefaultFilters(): HubFilterState {
    return {
        types: new Set<ImgType>(),
        rating: 0,
        label: 'Any',
    }
}

export function formatCount(count: number) {
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`
    return String(count)
}

export function buildFilters(
    filters: HubFilterState,
    searchTerm: string
): ImageHubAssetFilters | undefined {
    const payload: ImageHubAssetFilters = {}
    if (filters.types.size) {
        payload.types = Array.from(filters.types)
    }
    if (filters.rating > 0) {
        payload.ratings = [filters.rating]
    }
    if (filters.label !== 'Any') {
        payload.labels = [filters.label]
    }
    if (filters.dateFrom) payload.dateFrom = filters.dateFrom
    if (filters.dateTo) payload.dateTo = filters.dateTo
    if (searchTerm.trim()) payload.search = searchTerm.trim()
    return Object.keys(payload).length ? payload : undefined
}

export function groupAssetsByPair(assets: ImageHubAsset[]): HubTile[] {
    const pairMap = new Map<string, HubTile>()
    const orderedTiles: HubTile[] = []
    assets.forEach((asset) => {
        if (asset.is_paired && asset.pair_id) {
            let tile = pairMap.get(asset.pair_id)
            if (!tile) {
                tile = {
                    id: `pair-${asset.pair_id}`,
                    primary: asset,
                    assetIds: [asset.asset_id],
                    isPaired: true,
                }
                pairMap.set(asset.pair_id, tile)
                orderedTiles.push(tile)
            } else {
                tile.assetIds.push(asset.asset_id)
                if (!tile.secondary) {
                    if (asset.type === 'JPEG' && tile.primary.type === 'RAW') {
                        tile.secondary = tile.primary
                        tile.primary = asset
                    } else {
                        tile.secondary = asset
                    }
                }
            }
        } else {
            orderedTiles.push({
                id: asset.asset_id,
                primary: asset,
                assetIds: [asset.asset_id],
                isPaired: false,
            })
        }
    })
    return orderedTiles
}

export function useDebouncedValue<T>(value: T, delay: number): T {
    const [debounced, setDebounced] = useState(value)
    useEffect(() => {
        const timer = window.setTimeout(() => setDebounced(value), delay)
        return () => window.clearTimeout(timer)
    }, [value, delay])
    return debounced
}
