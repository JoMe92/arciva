import React, { useCallback, useMemo, useRef } from 'react'
import type { CropRect } from '../types'
import { clampCropRect, fitRectToAspect, MIN_CROP_EDGE } from '../cropUtils'

type HandleType = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

type CropOverlayProps = {
  width: number
  height: number
  scale: number
  rect: CropRect
  aspectRatio: number | null
  onChange: (rect: CropRect) => void
  active: boolean
}

const HANDLE_CURSORS: Record<Exclude<HandleType, 'move'>, React.CSSProperties['cursor']> = {
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
  ne: 'nesw-resize',
  nw: 'nwse-resize',
  se: 'nwse-resize',
  sw: 'nesw-resize',
}

const HANDLE_ANCHORS: Record<
  Exclude<HandleType, 'move'>,
  { x: 'min' | 'max' | 'center'; y: 'min' | 'max' | 'center' }
> = {
  n: { x: 'center', y: 'max' },
  s: { x: 'center', y: 'min' },
  e: { x: 'min', y: 'center' },
  w: { x: 'max', y: 'center' },
  ne: { x: 'min', y: 'max' },
  nw: { x: 'max', y: 'max' },
  se: { x: 'min', y: 'min' },
  sw: { x: 'max', y: 'min' },
}

type DragState = {
  type: HandleType
  pointerId: number
  startRect: CropRect
  startX: number
  startY: number
  widthPx: number
  heightPx: number
}

export function CropOverlay({
  width,
  height,
  scale,
  rect,
  aspectRatio,
  onChange,
  active,
}: CropOverlayProps) {
  const dragRef = useRef<DragState | null>(null)
  const normalizedRect = useMemo(() => clampCropRect(rect), [rect])
  const left = normalizedRect.x * width
  const top = normalizedRect.y * height
  const cropWidth = normalizedRect.width * width
  const cropHeight = normalizedRect.height * height

  const startDrag = useCallback(
    (type: HandleType, event: React.PointerEvent<HTMLDivElement>) => {
      if (!active) return
      event.preventDefault()
      event.stopPropagation()
      event.currentTarget.setPointerCapture(event.pointerId)
      const widthPx = Math.max(1, width * (scale || 1))
      const heightPx = Math.max(1, height * (scale || 1))
      dragRef.current = {
        type,
        pointerId: event.pointerId,
        startRect: normalizedRect,
        startX: event.clientX,
        startY: event.clientY,
        widthPx,
        heightPx,
      }
    },
    [active, normalizedRect, scale, width, height]
  )

  const updateDrag = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      event.preventDefault()
      if (!width || !height) return
      const deltaX = drag.widthPx ? (event.clientX - drag.startX) / drag.widthPx : 0
      const deltaY = drag.heightPx ? (event.clientY - drag.startY) / drag.heightPx : 0
      const nextRect =
        drag.type === 'move'
          ? moveRect(drag.startRect, deltaX, deltaY)
          : resizeRect(drag.type, drag.startRect, deltaX, deltaY, aspectRatio)
      onChange(nextRect)
    },
    [aspectRatio, height, onChange, width]
  )

  const endDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }, [])

  if (!active || !width || !height) return null

  const maskSections = [
    { left: 0, top: 0, width, height: top },
    { left: 0, top, width: left, height: cropHeight },
    { left: left + cropWidth, top, width: width - (left + cropWidth), height: cropHeight },
    { left: 0, top: top + cropHeight, width, height: height - (top + cropHeight) },
  ].filter((section) => section.width > 0 && section.height > 0)

  return (
    <div className="absolute inset-0" style={{ touchAction: 'none' }}>
      <div className="absolute inset-0 pointer-events-none">
        {maskSections.map((section, index) => (
          <div
            // eslint-disable-next-line react/no-array-index-key
            key={index}
            className="absolute bg-[rgba(0,0,0,0.55)] pointer-events-none"
            style={section}
          />
        ))}
      </div>

      <div
        className="absolute border border-white/90 shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"
        style={{
          left,
          top,
          width: cropWidth,
          height: cropHeight,
          cursor: 'move',
        }}
        onPointerDown={(event) => startDrag('move', event)}
        onPointerMove={updateDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3">
          {Array.from({ length: 9 }).map((_, index) => (
            <div
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              className="border border-white/20"
              aria-hidden="true"
            />
          ))}
        </div>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-y-0 left-1/2 w-px bg-white/60" />
          <div className="absolute inset-x-0 top-1/2 h-px bg-white/60" />
        </div>
      </div>

      <div className="absolute" style={{ left, top, width: cropWidth, height: cropHeight }}>
        {renderHandle('nw', left, top, startDrag, updateDrag, endDrag)}
        {renderHandle('ne', left + cropWidth, top, startDrag, updateDrag, endDrag)}
        {renderHandle('sw', left, top + cropHeight, startDrag, updateDrag, endDrag)}
        {renderHandle('se', left + cropWidth, top + cropHeight, startDrag, updateDrag, endDrag)}
        {renderEdgeHandle('n', left + cropWidth / 2, top, startDrag, updateDrag, endDrag)}
        {renderEdgeHandle('s', left + cropWidth / 2, top + cropHeight, startDrag, updateDrag, endDrag)}
        {renderEdgeHandle('w', left, top + cropHeight / 2, startDrag, updateDrag, endDrag)}
        {renderEdgeHandle('e', left + cropWidth, top + cropHeight / 2, startDrag, updateDrag, endDrag)}
      </div>
    </div>
  )
}

function renderHandle(
  type: Exclude<HandleType, 'move' | 'n' | 's' | 'e' | 'w'>,
  x: number,
  y: number,
  startDrag: (type: HandleType, event: React.PointerEvent<HTMLDivElement>) => void,
  updateDrag: (event: React.PointerEvent<HTMLDivElement>) => void,
  endDrag: (event: React.PointerEvent<HTMLDivElement>) => void
) {
  const size = 14
  return (
    <div
      className="absolute z-10 rounded-full border border-white bg-[rgba(0,0,0,0.4)]"
      style={{
        width: size,
        height: size,
        left: x - size / 2,
        top: y - size / 2,
        cursor: HANDLE_CURSORS[type],
      }}
      onPointerDown={(event) => startDrag(type, event)}
      onPointerMove={updateDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    />
  )
}

function renderEdgeHandle(
  type: Extract<HandleType, 'n' | 's' | 'e' | 'w'>,
  x: number,
  y: number,
  startDrag: (type: HandleType, event: React.PointerEvent<HTMLDivElement>) => void,
  updateDrag: (event: React.PointerEvent<HTMLDivElement>) => void,
  endDrag: (event: React.PointerEvent<HTMLDivElement>) => void
) {
  const isHorizontal = type === 'n' || type === 's'
  const width = isHorizontal ? 24 : 12
  const height = isHorizontal ? 12 : 24
  return (
    <div
      className="absolute z-10 rounded-full border border-white bg-[rgba(0,0,0,0.4)]"
      style={{
        width,
        height,
        left: x - width / 2,
        top: y - height / 2,
        cursor: HANDLE_CURSORS[type],
      }}
      onPointerDown={(event) => startDrag(type, event)}
      onPointerMove={updateDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    />
  )
}

function moveRect(rect: CropRect, dx: number, dy: number): CropRect {
  const clamped = clampCropRect(rect)
  const nextRect = {
    x: clamped.x + dx,
    y: clamped.y + dy,
    width: clamped.width,
    height: clamped.height,
  }
  return clampCropRect(nextRect)
}

function resizeRect(
  type: Exclude<HandleType, 'move'>,
  rect: CropRect,
  dx: number,
  dy: number,
  aspectRatio: number | null
): CropRect {
  const next = resizeFree(type, rect, dx, dy)
  if (!aspectRatio) return next
  return fitToRatio(type, next, aspectRatio)
}

function resizeFree(type: Exclude<HandleType, 'move'>, rect: CropRect, dx: number, dy: number) {
  let left = rect.x
  let top = rect.y
  let right = rect.x + rect.width
  let bottom = rect.y + rect.height
  const minWidth = MIN_CROP_EDGE
  const minHeight = MIN_CROP_EDGE
  if (type.includes('n')) {
    top = clampValue(top + dy, 0, bottom - minHeight)
  }
  if (type.includes('s')) {
    bottom = clampValue(bottom + dy, top + minHeight, 1)
  }
  if (type.includes('w')) {
    left = clampValue(left + dx, 0, right - minWidth)
  }
  if (type.includes('e')) {
    right = clampValue(right + dx, left + minWidth, 1)
  }
  return clampCropRect({ x: left, y: top, width: right - left, height: bottom - top })
}

function fitToRatio(
  type: Exclude<HandleType, 'move'>,
  rect: CropRect,
  aspectRatio: number
): CropRect {
  const anchor = HANDLE_ANCHORS[type]
  const width = rect.width
  const height = rect.height
  const target = fitRectToAspect({ ...rect, width, height }, aspectRatio)
  const anchored = applyAnchor(rect, target.width, target.height, anchor)
  return clampCropRect(anchored)
}

function applyAnchor(
  rect: CropRect,
  width: number,
  height: number,
  anchor: { x: 'min' | 'max' | 'center'; y: 'min' | 'max' | 'center' }
): CropRect {
  const left = rect.x
  const right = rect.x + rect.width
  const top = rect.y
  const bottom = rect.y + rect.height
  const centerX = left + rect.width / 2
  const centerY = top + rect.height / 2
  let x = left
  let y = top
  if (anchor.x === 'min') {
    x = left
  } else if (anchor.x === 'max') {
    x = right - width
  } else {
    x = centerX - width / 2
  }
  if (anchor.y === 'min') {
    y = top
  } else if (anchor.y === 'max') {
    y = bottom - height
  } else {
    y = centerY - height / 2
  }
  return { x, y, width, height }
}

function clampValue(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min
  if (value < min) return min
  if (value > max) return max
  return value
}
