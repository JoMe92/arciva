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
  it('keeps the status slot width stable', () => {
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

    render(
      <ThemeProvider>
        <TopBar
          projectName="Test Project"
          onBack={vi.fn()}
          onRename={vi.fn()}
          renamePending={false}
          renameError={null}
          view="grid"
          onChangeView={vi.fn()}
          gridSize={160}
          minGridSize={120}
          onGridSizeChange={vi.fn()}
          filters={createFilterControls()}
          filterCount={0}
          onResetFilters={vi.fn()}
          visibleCount={12}
          stackPairsEnabled={false}
          onToggleStackPairs={vi.fn()}
          stackTogglePending={false}
          selectedDayLabel="2024-07-22"
          loadingAssets={false}
          loadError={null}
        />
      </ThemeProvider>,
    )

    const slot = screen.getByTestId('top-bar-status-slot')
    expect(slot).toHaveStyle({
      minWidth: '200px',
      maxWidth: '220px',
    })
  })
})
