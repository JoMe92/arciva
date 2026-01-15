
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import ImageHub from '../ImageHub'
import { fetchImageHubProjects, fetchImageHubAssets } from '../../shared/api/hub'
import type { ImageHubProject, ImageHubAssetsPage, ImageHubAsset } from '../../shared/api/hub'
import { ThemeProvider } from '../../shared/theme'

// Type-safe mocks
vi.mock('../../shared/api/hub', () => ({
    fetchImageHubProjects: vi.fn(),
    fetchImageHubAssets: vi.fn(),
}))

vi.mock('../../features/auth/AuthContext', () => ({
    useAuth: () => ({ user: { id: 'test-user' }, isAuthenticated: true }),
    AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(), // deprecated
        removeListener: vi.fn(), // deprecated
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
})

const mockFetchProjects = fetchImageHubProjects as unknown as ReturnType<typeof vi.fn>
const mockFetchAssets = fetchImageHubAssets as unknown as ReturnType<typeof vi.fn>

// Mock data
const mockProjects: ImageHubProject[] = [
    {
        project_id: 'p1',
        name: 'Project One',
        asset_count: 5,
        updated_at: '2023-10-01T10:00:00Z',
    },
    {
        project_id: 'p2',
        name: 'Project Two',
        asset_count: 3,
        updated_at: '2023-11-01T10:00:00Z',
    },
]

const mockAssets: ImageHubAsset[] = [
    {
        asset_id: 'a1',
        original_filename: 'photo1.jpg',
        type: 'JPEG',
        created_at: '2023-10-01T10:00:00Z',
        rating: 0,
        label: 'None',
        width: 800,
        height: 600,
        is_paired: false,
        projects: [],
    },
]

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    })
    return ({ children }: { children: React.ReactNode }) => (
        <ThemeProvider>
            <QueryClientProvider client={queryClient}>
                <MemoryRouter>{children}</MemoryRouter>
            </QueryClientProvider>
        </ThemeProvider>
    )
}

describe('ImageHub', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockFetchProjects.mockResolvedValue({
            projects: mockProjects,
            next_cursor: null
        })
        mockFetchAssets.mockResolvedValue({
            assets: mockAssets,
            next_cursor: null,
            buckets: [],
        } as ImageHubAssetsPage)
    })

    it('renders loading state initially', () => {
        mockFetchProjects.mockImplementation(() => new Promise(() => { })) // Never resolves
        render(<ImageHub />, { wrapper: createWrapper() })
        expect(screen.getByText('Loading projects…')).toBeInTheDocument()
    })

    it('renders projects and assets', async () => {
        render(<ImageHub />, { wrapper: createWrapper() })

        // Check projects loaded
        await waitFor(() => expect(screen.getByText('Project One')).toBeInTheDocument())
        expect(screen.getByText('Project Two')).toBeInTheDocument()

        // Check assets loaded for first project (default)
        await waitFor(() => expect(screen.getByText('photo1.jpg')).toBeInTheDocument())

        expect(mockFetchProjects).toHaveBeenCalled()
        expect(mockFetchAssets).toHaveBeenCalledWith(expect.objectContaining({
            mode: 'project',
            projectId: 'p1'
        }))
    })

    it('filters assets when clicking a project', async () => {
        render(<ImageHub />, { wrapper: createWrapper() })
        await waitFor(() => expect(screen.getByText('Project One')).toBeInTheDocument())

        fireEvent.click(screen.getByText('Project Two'))

        await waitFor(() => {
            expect(mockFetchAssets).toHaveBeenCalledWith(expect.objectContaining({
                projectId: 'p2'
            }))
        })
    })

    it('switches to Date view', async () => {
        render(<ImageHub />, { wrapper: createWrapper() })

        fireEvent.click(screen.getByText('By Date'))

        expect(mockFetchAssets).toHaveBeenCalledWith(expect.objectContaining({
            mode: 'date'
        }))
    })
})
