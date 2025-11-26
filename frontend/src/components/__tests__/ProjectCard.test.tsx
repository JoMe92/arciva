import { render, fireEvent, screen } from '@testing-library/react'
import { vi } from 'vitest'
import ProjectCard from '../ProjectCard'
import type { Project } from '../../features/projects/types'

const baseProject: Project = {
  id: 'project-card',
  title: 'Sample Project',
  client: 'Sample Client',
  aspect: 'landscape',
  previewImages: [],
}

function renderCard(overrides: Partial<Project> = {}) {
  const project = { ...baseProject, ...overrides }
  const utils = render(
    <ProjectCard
      p={project}
      onOpen={vi.fn()}
      onArchive={vi.fn()}
      onUnarchive={vi.fn()}
      archiveMode={false}
      onEdit={vi.fn()}
    />
  )
  return { project, ...utils }
}

describe('ProjectCard preview browsing', () => {
  it('cycles previews with the mouse wheel while hovering', () => {
    const previewImages = [
      { url: 'thumb-1.jpg', order: 0, width: 800, height: 600 },
      { url: 'thumb-2.jpg', order: 1, width: 800, height: 600 },
    ]
    renderCard({ id: 'wheel', title: 'Wheel', client: 'Client', previewImages })
    const card = screen.getByTestId('project-card-wheel')
    const img = screen.getByRole('img', { name: 'Wheel – Client' })

    expect(img).toHaveAttribute('src', 'thumb-1.jpg')
    fireEvent.mouseEnter(card)
    fireEvent.wheel(card, { deltaY: 120 })
    expect(img).toHaveAttribute('src', 'thumb-2.jpg')
    fireEvent.wheel(card, { deltaY: -120 })
    expect(img).toHaveAttribute('src', 'thumb-1.jpg')
  })

  it('responds to arrow keys when the preview is hovered', () => {
    const previewImages = [
      { url: 'series-1.jpg', order: 0, width: 800, height: 600 },
      { url: 'series-2.jpg', order: 1, width: 800, height: 600 },
      { url: 'series-3.jpg', order: 2, width: 800, height: 600 },
    ]
    renderCard({ id: 'keys', title: 'Keyboard', client: 'Client', previewImages })
    const card = screen.getByTestId('project-card-keys')
    const img = screen.getByRole('img', { name: 'Keyboard – Client' })

    expect(img).toHaveAttribute('src', 'series-1.jpg')
    fireEvent.mouseEnter(card)
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(img).toHaveAttribute('src', 'series-2.jpg')
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(img).toHaveAttribute('src', 'series-3.jpg')
    fireEvent.mouseLeave(card)
  })
})
