import { render, fireEvent, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ImportSheet } from '../ProjectWorkspace'
import { vi } from 'vitest'

function createFile(name: string, opts: { type?: string; size?: number; relativePath?: string } = {}): File {
  const { type = 'image/jpeg', size = 1024, relativePath } = opts
  const file = new File([new ArrayBuffer(size)], name, { type })
  if (relativePath !== undefined) {
    Object.defineProperty(file, 'webkitRelativePath', {
      configurable: true,
      enumerable: true,
      value: relativePath,
    })
  }
  return file
}

function createFileList(files: File[]): FileList {
  const iterable = {
    *[Symbol.iterator]() {
      for (const file of files) {
        yield file
      }
    },
  }
  const fileList = Object.assign([], files, {
    length: files.length,
    item: (index: number) => files[index] ?? null,
    ...iterable,
  })
  return fileList as unknown as FileList
}

function setFiles(input: HTMLInputElement, files: File[]) {
  const fileList = createFileList(files)
  Object.defineProperty(input, 'files', {
    configurable: true,
    enumerable: true,
    writable: false,
    value: fileList,
  })
  return fileList
}

describe('ImportSheet local selection queue feedback', () => {
  const originalResizeObserver = globalThis.ResizeObserver
  const originalCreateObjectURL = globalThis.URL.createObjectURL
  const originalRevokeObjectURL = globalThis.URL.revokeObjectURL

  beforeAll(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    )
    globalThis.URL.createObjectURL = vi.fn(() => 'blob://test/' + Math.random())
    globalThis.URL.revokeObjectURL = vi.fn()
  })

  afterAll(() => {
    if (originalResizeObserver) {
      globalThis.ResizeObserver = originalResizeObserver
    } else {
      // @ts-expect-error - allow cleanup in environments without ResizeObserver
      delete globalThis.ResizeObserver
    }
    globalThis.URL.createObjectURL = originalCreateObjectURL
    globalThis.URL.revokeObjectURL = originalRevokeObjectURL
  })

  function renderSheet() {
    const onClose = vi.fn()
    const onImport = vi.fn()
    const onProgressSnapshot = vi.fn()
    const client = new QueryClient()
    const utils = render(
      <QueryClientProvider client={client}>
        <ImportSheet
          projectId="project-123"
          onClose={onClose}
          onImport={onImport}
          onProgressSnapshot={onProgressSnapshot}
          folderMode="custom"
          customFolder="Test Folder"
        />
      </QueryClientProvider>,
    )
    return { ...utils, onClose, onImport, onProgressSnapshot }
  }

  it('shows progress feedback when selecting files via the files picker', async () => {
    const { container, onProgressSnapshot } = renderSheet()
    const inputs = container.querySelectorAll('input[type="file"]')
    expect(inputs.length).toBeGreaterThanOrEqual(2)
    const filesInput = inputs[0] as HTMLInputElement

    const manyFiles = Array.from({ length: 64 }, (_, idx) => createFile(`image-${idx + 1}.jpg`))
    const fileList = setFiles(filesInput, manyFiles)
    fireEvent.change(filesInput, { target: { files: fileList } })

    await waitFor(() => {
      expect(onProgressSnapshot).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(screen.getByText('Selected files & folders')).toBeInTheDocument()
    })
  })

  it('shows progress feedback when selecting a folder', async () => {
    const { container, onProgressSnapshot } = renderSheet()
    const inputs = container.querySelectorAll('input[type="file"]')
    const folderInput = inputs[1] as HTMLInputElement

    const folderFiles = Array.from({ length: 64 }, (_, idx) =>
      createFile(`nested-${idx + 1}.jpg`, { relativePath: `folder/nested-${idx + 1}.jpg` }),
    )
    const folderFileList = setFiles(folderInput, folderFiles)
    fireEvent.change(folderInput, { target: { files: folderFileList } })

    await waitFor(() => {
      expect(onProgressSnapshot).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(screen.getByText('Selected files & folders')).toBeInTheDocument()
    })
  })
})
