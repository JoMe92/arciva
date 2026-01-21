
import React from 'react'
import type { ImageHubProject } from '../../../shared/api/hub'

const DATE_FULL_FORMAT = new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
})

type ProjectListProps = {
    projects: ImageHubProject[]
    isLoading: boolean
    error: Error | null
    activeProjectId: string | null
    onSelectProject: (id: string) => void
    hasMore: boolean
    onLoadMore: () => void
    isFetchingMore: boolean
}

export default function ProjectList({
    projects,
    isLoading,
    error,
    activeProjectId,
    onSelectProject,
    hasMore,
    onLoadMore,
    isFetchingMore,
}: ProjectListProps) {
    if (isLoading) {
        return <div className="p-4 text-xs text-[var(--text-muted,#6B645B)]">Loading projects…</div>
    }
    if (error) {
        return (
            <div className="p-4 text-xs text-[#B42318]">Failed to load projects. {error.message}</div>
        )
    }
    if (!projects.length) {
        return (
            <div className="p-4 text-xs text-[var(--text-muted,#6B645B)]">
                You have no projects with Hub assets yet.
            </div>
        )
    }
    return (
        <div className="flex h-full flex-col">
            <ul className="flex-1 divide-y divide-[var(--border,#E1D3B9)] overflow-y-auto">
                {projects.map((project) => {
                    const active = project.project_id === activeProjectId
                    return (
                        <li key={project.project_id}>
                            <button
                                type="button"
                                className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm ${active ? 'bg-[var(--sand-100,#F3EBDD)] font-semibold' : ''}`}
                                onClick={() => onSelectProject(project.project_id)}
                            >
                                {project.cover_thumb ? (
                                    <img
                                        src={project.cover_thumb}
                                        alt=""
                                        className="h-10 w-10 rounded object-cover"
                                        loading="lazy"
                                    />
                                ) : (
                                    <div className="h-10 w-10 rounded bg-[var(--sand-200,#F0E5CF)]" />
                                )}
                                <div className="flex-1">
                                    <div className="truncate">{project.name}</div>
                                    <div className="text-xs text-[var(--text-muted,#6B645B)]">
                                        {project.asset_count} assets • Updated{' '}
                                        {project.updated_at
                                            ? DATE_FULL_FORMAT.format(new Date(project.updated_at))
                                            : '—'}
                                    </div>
                                </div>
                            </button>
                        </li>
                    )
                })}
            </ul>
            {hasMore && (
                <div className="border-t border-[var(--border,#E1D3B9)] p-3 text-center">
                    <button
                        type="button"
                        onClick={onLoadMore}
                        disabled={isFetchingMore}
                        className={`rounded border border-[var(--border,#E1D3B9)] px-3 py-1.5 text-xs ${isFetchingMore ? 'opacity-60' : ''}`}
                    >
                        {isFetchingMore ? 'Loading…' : 'Load more projects'}
                    </button>
                </div>
            )}
        </div>
    )
}
