import React from 'react'
import { Link } from 'react-router-dom'
import StoneTrailLogo from '../components/StoneTrailLogo'
import { useTheme } from '../shared/theme'
import UserMenu from '../features/auth/UserMenu'
import ImageHubBrowser from '../features/hub/ImageHubBrowser'

export default function ImageHub() {
    const { mode, toggle } = useTheme()

    return (
        <div className="flex h-screen flex-col bg-[var(--background,#FBF7EF)] text-[var(--text,#1F1E1B)] transition-colors duration-300">
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
                        <UserMenu />
                    </div>
                </div>
            </header>

            {/* Content */}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
                <ImageHubBrowser mode="page" />
            </div>
        </div>
    )
}
