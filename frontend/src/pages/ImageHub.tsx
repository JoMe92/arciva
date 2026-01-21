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
            <div className="border-b border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)]/90 backdrop-blur">
                <div className="mx-auto max-w-7xl px-4 py-2 flex items-center gap-3">
                    <Link to="/" className="flex items-center gap-2">
                        <StoneTrailLogo className="shrink-0" mode={mode} onToggleTheme={toggle} />
                        <span className="text-sm font-semibold tracking-wide">Image Hub</span>
                    </Link>
                    <div className="ml-auto">
                        <UserMenu />
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
                <ImageHubBrowser mode="page" />
            </div>
        </div>
    )
}
