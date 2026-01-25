
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import ProjectIndex from '../ProjectIndex'
import { listProjects } from '../../shared/api/projects'
import { ThemeProvider } from '../../shared/theme'
import { BulkExportProvider } from '../../shared/bulkExport/BulkImageExportContext'

// Mocks
vi.mock('../../shared/api/projects', () => ({
    listProjects: vi.fn(),
    createProject: vi.fn(),
    deleteProject: vi.fn(),
}))

vi.mock('../../features/auth/AuthContext', () => ({
    useAuth: () => ({ user: { id: 'test-user' }, logout: vi.fn() }),
    AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom')
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    }
})

const mockListProjects = listProjects as unknown as ReturnType<typeof vi.fn>

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
                <BulkExportProvider>
                    <MemoryRouter>{children}</MemoryRouter>
                </BulkExportProvider>
            </QueryClientProvider>
        </ThemeProvider>
    )
}

describe('ProjectIndex', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockListProjects.mockResolvedValue([
            {
                id: 'p1',
                title: 'Project One',
                client: 'Client A',
                created_at: '2023-10-01T10:00:00Z',
            },
        ])
    })

    it('renders project and supports "Enter" to navigate', async () => {
        render(<ProjectIndex />, { wrapper: createWrapper() })

        await waitFor(() => expect(screen.getByText('Project One')).toBeInTheDocument())

        const searchInput = screen.getByPlaceholderText('Search projects…')
        fireEvent.change(searchInput, { target: { value: 'Project One' } })

        fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' })

        expect(mockNavigate).toHaveBeenCalledWith('/projects/p1')
    })
})
