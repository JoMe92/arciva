import React, { useRef, useState, useCallback, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import StoneTrailLogo from '../components/StoneTrailLogo'
import { useTheme } from '../shared/theme'
import UserMenu from '../features/auth/UserMenu'
import ImageHubBrowser from '../features/hub/ImageHubBrowser'
import { ImportIcon } from '../features/workspace/components/icons'
import { initDirectUpload, putUpload, completeUpload } from '../shared/api/uploads'

export default function ImageHub() {
    const { mode, toggle } = useTheme()
    const queryClient = useQueryClient()
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Upload State
    const [uploading, setUploading] = useState(false)
    const [progress, setProgress] = useState(0)
    const [totalFiles, setTotalFiles] = useState(0)
    const [processedFiles, setProcessedFiles] = useState(0)
    const [dragActive, setDragActive] = useState(false)

    const handleImportClick = () => {
        fileInputRef.current?.click()
    }

    const processFiles = async (files: File[]) => {
        if (!files.length) return
        setUploading(true)
        setTotalFiles(files.length)
        setProcessedFiles(0)
        setProgress(0)

        // Process sequentially to keep it simple for now
        for (let i = 0; i < files.length; i++) {
            const file = files[i]
            try {
                // 1. Init
                const init = await initDirectUpload({
                    filename: file.name,
                    sizeBytes: file.size,
                    mimeType: file.type || 'application/octet-stream',
                })

                // 2. Put
                await putUpload(init.assetId, file, init.uploadToken, (e) => {
                    if (e.lengthComputable) {
                        // Per-file progress (optional refinement: combine total)
                    }
                })

                // 3. Complete
                await completeUpload(init.assetId, init.uploadToken, {})

            } catch (err) {
                console.error(`Failed to upload ${file.name}:`, err)
            } finally {
                setProcessedFiles(prev => prev + 1)
                setProgress(((i + 1) / files.length) * 100)
            }
        }

        // Refresh Hub
        await queryClient.invalidateQueries({ queryKey: ['imagehub-assets'] })

        // Brief delay to show completion
        setTimeout(() => {
            setUploading(false)
            setProcessedFiles(0)
            setTotalFiles(0)
            setProgress(0)
        }, 1000)
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? [])
        processFiles(files)
        e.target.value = '' // reset
    }

    // Drag & Drop
    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setDragActive(true)
    }

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setDragActive(false)
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setDragActive(true)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setDragActive(false)
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            processFiles(Array.from(e.dataTransfer.files))
        }
    }

    return (
        <div
            className="flex h-screen flex-col bg-[var(--background,#FBF7EF)] text-[var(--text,#1F1E1B)] transition-colors duration-300 relative"
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            {/* AppBar */}
            <header className="border-b border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)]/90 backdrop-blur sticky top-0 z-50">
                <div
                    className="grid h-16 w-full items-center gap-4"
                    style={{ gridTemplateColumns: 'minmax(0,1fr) auto minmax(0,1fr)' }}
                >
                    <div className="flex min-w-0 items-center gap-3 pl-2 sm:pl-4">
                        <StoneTrailLogo
                            className="shrink-0"
                            showLabel={false}
                            mode={mode}
                            onToggleTheme={toggle}
                        />
                        <span className="text-[var(--text-muted,#6B645B)]">›</span>
                        <Link
                            to="/"
                            className="text-sm font-medium text-[var(--text-muted,#6B645B)] hover:text-[var(--text,#1F1E1B)] transition-colors whitespace-nowrap"
                        >
                            Project Cards
                        </Link>
                    </div>

                    <div className="flex items-center justify-center font-semibold tracking-wide text-[var(--text,#1F1E1B)] whitespace-nowrap">
                        Image Hub
                    </div>

                    <div className="flex min-w-0 items-center justify-end gap-3 px-4 sm:px-6 lg:px-8">
                        <button
                            onClick={handleImportClick}
                            disabled={uploading}
                            className="hidden sm:inline-flex items-center gap-2 rounded-full border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--text,#1F1E1B)] hover:border-[var(--text,#1F1E1B)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ImportIcon className="h-4 w-4" />
                            <span>Import</span>
                        </button>
                        <UserMenu />
                    </div>
                </div>
            </header>

            {/* Content */}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 relative">
                <ImageHubBrowser mode="page" />

                {/* Drag Overlay */}
                {dragActive && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-[var(--sand-100,#F6EEDD)]/90 backdrop-blur-sm m-4 rounded-[var(--r-lg,20px)] border-2 border-dashed border-[var(--clay-500,#A56A4A)]">
                        <div className="text-center">
                            <ImportIcon className="h-16 w-16 mx-auto text-[var(--clay-500,#A56A4A)] mb-4" />
                            <p className="text-xl font-semibold text-[var(--clay-500,#A56A4A)]">Drop images to upload</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Upload Progress Toast */}
            {uploading && (
                <div className="fixed bottom-6 right-6 z-[60] w-80 rounded-lg border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] p-4 shadow-xl">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold">Uploading...</span>
                        <span className="text-xs text-[var(--text-muted,#6B645B)]">{processedFiles} / {totalFiles}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-[var(--sand-100,#F3EBDD)] overflow-hidden">
                        <div
                            className="h-full bg-[var(--clay-500,#A56A4A)] transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            )}

            <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
            />
        </div>
    )
}
