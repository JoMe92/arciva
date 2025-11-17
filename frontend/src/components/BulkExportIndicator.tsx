import React from 'react'
import { useBulkImageExport } from '../shared/bulkExport/BulkImageExportContext'
import { formatBytes } from '../shared/formatBytes'

const progressText = (completed: number, total: number) => {
  if (total > 0) {
    return `${completed} of ${total} images`
  }
  return `${completed} image${completed === 1 ? '' : 's'}`
}

const BulkExportIndicator: React.FC = () => {
  const { state, cancelExport, dismissExport, downloadResult } = useBulkImageExport()
  const { phase, progress, error, result, estimate } = state

  if (phase === 'idle') return null

  const percent = progress.total > 0 ? Math.min(100, Math.round((progress.completed / progress.total) * 100)) : null
  const containerClasses =
    'fixed top-4 right-4 z-[90] w-72 rounded-2xl border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] p-4 shadow-lg'

  if (phase === 'estimating') {
    return (
      <div className={containerClasses}>
        <p className="text-sm font-semibold text-[var(--text,#1F1E1B)]">Preparing estimate…</p>
        <p className="text-xs text-[var(--text-muted,#6B645B)]">Counting images and calculating archive size.</p>
      </div>
    )
  }

  if (phase === 'running') {
    return (
      <div className={containerClasses}>
        <p className="text-sm font-semibold text-[var(--text,#1F1E1B)]">Preparing image archive…</p>
        <p className="text-xs text-[var(--text-muted,#6B645B)]">Packaging {progressText(progress.completed, progress.total)}</p>
        {estimate ? (
          <p className="text-xs text-[var(--text-muted,#6B645B)]">Estimated size: {estimate.totalFiles} images (~{formatBytes(estimate.totalBytes)}).</p>
        ) : null}
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--border,#E1D3B9)]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent ?? undefined}>
          <div
            className="h-full rounded-full bg-[var(--primary,#A56A4A)] transition-[width]"
            style={{ width: percent !== null ? `${percent}%` : '30%' }}
          />
        </div>
        <button
          type="button"
          onClick={cancelExport}
          className="mt-3 text-xs text-[var(--text-muted,#6B645B)] underline hover:text-[var(--text,#1F1E1B)]"
        >
          Cancel export
        </button>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className={containerClasses}>
        <p className="text-sm font-semibold text-red-700">Export failed</p>
        <p className="text-xs text-[var(--text-muted,#6B645B)]">{error ?? 'Unable to export images.'}</p>
        <button
          type="button"
          onClick={dismissExport}
          className="mt-3 inline-flex items-center rounded-full border border-[var(--border,#E1D3B9)] px-3 py-1 text-xs text-[var(--text,#1F1E1B)] hover:border-[var(--text,#1F1E1B)]"
        >
          Dismiss
        </button>
      </div>
    )
  }

  return (
    <div className={containerClasses}>
      <p className="text-sm font-semibold text-[var(--text,#1F1E1B)]">Image archive ready</p>
      <p className="text-xs text-[var(--text-muted,#6B645B)]">{result?.totalFiles ?? progress.completed} images packaged.</p>
      {estimate ? (
        <p className="text-xs text-[var(--text-muted,#6B645B)]">Estimated size: ~{formatBytes(estimate.totalBytes)}.</p>
      ) : null}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={downloadResult}
          disabled={!result?.downloadUrl}
          className={`flex-1 rounded-full px-3 py-1 text-xs font-semibold ${
            result?.downloadUrl
              ? 'bg-[var(--charcoal-900,#1F1E1B)] text-white hover:bg-[var(--charcoal-800,#2A2926)]'
              : 'cursor-not-allowed border border-[var(--border,#E1D3B9)] text-[var(--text-muted,#6B645B)]'
          }`}
        >
          Download
        </button>
        <button
          type="button"
          onClick={dismissExport}
          className="rounded-full border border-[var(--border,#E1D3B9)] px-3 py-1 text-xs text-[var(--text,#1F1E1B)] hover:border-[var(--text,#1F1E1B)]"
        >
          Close
        </button>
      </div>
    </div>
  )
}

export default BulkExportIndicator
