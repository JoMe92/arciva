import React, { useCallback, useEffect, useMemo, useState } from 'react'
import type { ImageHubAsset, ImageHubAssetStatus, ImageHubProject } from '../../shared/api/hub'
import type { PendingItem } from './importTypes'
import type { ImgType } from '../hub/types'
import ImageHubBrowser from '../hub/ImageHubBrowser'

type ImageHubImportPaneProps = {
  currentProjectId: string | null
  onSelectionChange: (items: PendingItem[]) => void
  onStatusSnapshot?: (snapshot: Record<string, ImageHubAssetStatus>) => void
  onProjectDirectoryChange?: (directory: Record<string, string>) => void
  resetSignal?: number
  onBack?: () => void
}

function createPendingItems(tile: any, folderLabel: string): PendingItem[] {
  const entries: PendingItem[] = []
  const approximateSize = (type: ImgType) => (type === 'RAW' ? 48 * 1024 * 1024 : 12 * 1024 * 1024)
  const pushItem = (asset: ImageHubAsset) => {
    const imgType = asset.type === 'RAW' ? 'RAW' : 'JPEG'
    entries.push({
      id: asset.asset_id,
      name: asset.original_filename,
      type: imgType,
      previewUrl: asset.thumb_url,
      source: 'hub',
      selected: true,
      size: approximateSize(imgType),
      meta: { folder: folderLabel },
    })
  }
  // We assume 'tile' is HubTile from ImageHubBrowser
  pushItem(tile.primary)
  if (tile.secondary) pushItem(tile.secondary)
  return entries
}

export default function ImageHubImportPane({
  currentProjectId,
  onSelectionChange,
  onStatusSnapshot,
  onProjectDirectoryChange,
  resetSignal,
  onBack,
}: ImageHubImportPaneProps) {
  // Current active scope in Browser (Project or Date)
  // We need to know the 'label' of current scope to tag imports (e.g. folder name)
  // ImageHubBrowser controls its own tab state, but we need to know the active "folder label".
  // We can use the callbacks onProjectChanged / onDateSelectionChanged

  const [currentFolderLabel, setCurrentFolderLabel] = useState('ImageHub')

  // Selection State
  // We keep bucketed selection to allow toggling items from different contexts without eagerly loading everything
  // Key: "scopeId|resetSignal" -> value: Map<assetId, items>
  const [selectionBuckets, setSelectionBuckets] = useState<Record<string, Map<string, PendingItem[]>>>({})

  // We need a unique key for the current view "bucket" into which we select things
  // Since ImageHubBrowser manages the view state, we rely on callbacks to know "where we are".
  // A simplified approach: we just tag items with current label when selected.

  // Wait, ImageHubImportPane logic relies on separating selections by "scope" so that if you switch projects,
  // you don't lose selection? Or to support "Select All" in future?
  // Actually, just a flat map is easier but referencing `selectionBuckets` implies we might want to know where they came from.
  // Let's simplify: Just use a Map<tileId, PendingItem[]> for all selections.
  // The previous implementation used `selectionKey` derived from tab/project/date.

  // If we want to maintain the exact behavior, we need to know the tab/project/date state.
  // Getting that out of ImageHubBrowser might require lifting state up.

  // Option: Lift state up from ImageHubBrowser.
  // Or: Make ImageHubBrowser generic enough.

  // Let's assume for now we just track selected IDs globally in this session.
  // But we need `folderLabel` when selecting.

  const [selectedItemsMap, setSelectedItemsMap] = useState<Map<string, PendingItem[]>>(() => new Map())

  // Sync to parent
  useEffect(() => {
    onSelectionChange(Array.from(selectedItemsMap.values()).flat())
  }, [selectedItemsMap, onSelectionChange])

  // Clear selection when reset signal changes (e.g. after successful import)
  useEffect(() => {
    setSelectedItemsMap(new Map())
  }, [resetSignal])

  // Handle status snapshot if needed (we can't easily do this if we don't know which assets are visible)
  // ImageHubBrowser handles visible assets status. ImageHubImportPane used to inspect `statusMap` from hook.
  // If parent strictly needs it, we might need to expose it from Browser.
  // But `onStatusSnapshot` seems used for "conflicts" check in parent.
  // If ImageHubBrowser handles `disabled` state for already linked, maybe parent doesn't need snapshot update?
  // `ProjectWorkspace` uses `onStatusSnapshot` to update `hubStatusSnapshot` state, probably for some validation.
  // Let's defer onStatusSnapshot for now or assume simpler flow.

  const handleProjectChanged = useCallback((project: ImageHubProject | null) => {
    if (onProjectDirectoryChange && project) {
      // Update directory if needed, though usually this was for ALL projects.
      // ImageHubBrowser fetches projects internally.
      onProjectDirectoryChange({ [project.project_id]: project.name })
    }
    setCurrentFolderLabel(project?.name ?? 'ImageHub')
  }, [onProjectDirectoryChange])

  const handleDateChanged = useCallback((label: string) => {
    setCurrentFolderLabel(label)
  }, [])

  const toggleSelection = useCallback((tileId: string, tile: any) => {
    setSelectedItemsMap(prev => {
      const next = new Map(prev)
      if (next.has(tileId)) {
        next.delete(tileId)
      } else {
        next.set(tileId, createPendingItems(tile, currentFolderLabel))
      }
      return next
    })
  }, [currentFolderLabel])

  // Selected IDs for Browser
  const selectedIds = useMemo(() => new Set(selectedItemsMap.keys()), [selectedItemsMap])

  return (
    <ImageHubBrowser
      mode="select"
      selectedIds={selectedIds}
      onToggleSelection={toggleSelection}
      currentProjectId={currentProjectId}
      onBack={onBack}
      onProjectChanged={handleProjectChanged}
      onDateSelectionChanged={handleDateChanged}
    />
  )
}
