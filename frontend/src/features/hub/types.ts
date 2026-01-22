
import type { ImageHubAsset, ImageHubAssetFilters } from '../../shared/api/hub'
import type { ColorLabelValue } from '../../shared/api/assets'

export type HubViewMode = 'grid' | 'list'
export type HubBrowserTab = 'project' | 'date'
export type ImgType = 'JPEG' | 'RAW'

export type HubFilterState = {
    types: Set<ImgType>
    rating: number
    label: 'Any' | ColorLabelValue
    dateFrom?: string
    dateTo?: string
}

export type HubTile = {
    id: string
    assetIds: string[]
    primary: ImageHubAsset
    secondary?: ImageHubAsset
    isPaired: boolean
}

export type VirtualMetrics = {
    scrollTop: number
    scrollHeight: number
    clientHeight: number
}
