import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { TopBar, type WorkspaceFilterControls } from '../components'
import { ThemeProvider } from '../../../shared/theme'

const createFilterControls = (): WorkspaceFilterControls => ({
  minStars: 0,
  setMinStars: vi.fn(),
  filterColor: 'Any',
  setFilterColor: vi.fn(),
  showJPEG: true,
  setShowJPEG: vi.fn(),
  showRAW: true,
  setShowRAW: vi.fn(),
  onlyPicked: false,
  setOnlyPicked: vi.fn(),
  hideRejected: false,
  setHideRejected: vi.fn(),
  dateFilterActive: false,
  selectedDayLabel: null,
  clearDateFilter: vi.fn(),
})

describe('TopBar layout', () => {
  it('keeps the size control width stable across view modes', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })

    const baseProps = {
      projectName: 'Test Project',
      onBack: vi.fn(),
      onRename: vi.fn(),
      renamePending: false,
      renameError: null,
      onChangeView: vi.fn(),
      gridSize: 160,
      minGridSize: 120,
      onGridSizeChange: vi.fn(),
      filters: createFilterControls(),
      filterCount: 0,
      onResetFilters: vi.fn(),
      stackPairsEnabled: false,
      onToggleStackPairs: vi.fn(),
      stackTogglePending: false,
    } as const

    const { rerender } = render(
      <ThemeProvider>
        <TopBar {...baseProps} view="grid" />
      </ThemeProvider>,
    )
    const sizeControl = screen.getByTestId('top-bar-size-control')
    expect(sizeControl).toHaveStyle({ width: '200px' })

    rerender(
        <ThemeProvider>
          <TopBar {...baseProps} view="detail" />
        </ThemeProvider>,
      )
    expect(sizeControl).toHaveStyle({ width: '200px' })
    expect(sizeControl).toHaveTextContent('Unavailable in detail view')
  })
})
