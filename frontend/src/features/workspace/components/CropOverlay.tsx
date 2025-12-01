import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react'
import type { CropRect } from '../types'
import { clampCropRect, fitRectToAspect, MIN_CROP_EDGE, clamp } from '../cropUtils'

type HandleType = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

type CropOverlayProps = {
  width: number
  height: number
  scale: number
  rect: CropRect
  aspectRatio: number | null
  onChange: (rect: CropRect) => void
  active: boolean
  rotationAngle: number
  rotationScale: number
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
  rotationAngle,
  rotationScale,
}: CropOverlayProps) {
  const dragRef = useRef<DragState | null>(null)
  const [activeHandle, setActiveHandle] = useState<HandleType | null>(null)
  const [isHoveringFrame, setIsHoveringFrame] = useState(false)
  const [hoverHandle, setHoverHandle] = useState<HandleType | null>(null)
  const normalizedRect = useMemo(() => clampCropRect(rect), [rect])
  const left = normalizedRect.x * width
  const top = normalizedRect.y * height
  const cropWidth = normalizedRect.width * width
  const cropHeight = normalizedRect.height * height
  const containerRatio =
    Number.isFinite(width) && Number.isFinite(height) && height > 0 ? width / height : 1
  const handleScale = scale && scale > 0 ? 1 / scale : 1
  const cornerPositions: Record<'nw' | 'ne' | 'sw' | 'se', { x: number; y: number }> = {
    nw: { x: 0, y: 0 },
    ne: { x: 1, y: 0 },
    sw: { x: 0, y: 1 },
    se: { x: 1, y: 1 },
  }
  const edgePositions: Record<'n' | 's' | 'w' | 'e', { x: number; y: number }> = {
    n: { x: 0.5, y: 0 },
    s: { x: 0.5, y: 1 },
    w: { x: 0, y: 0.5 },
    e: { x: 1, y: 0.5 },
  }
  const startDrag = useCallback(
    (type: HandleType, event: React.PointerEvent<HTMLDivElement>) => {
      if (!active || event.button !== 0) return
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
      setActiveHandle(type)
    },
    [active, normalizedRect, scale, width, height]
  )

  const clampWithRotation = useCallback(
    (next: CropRect) => {
      return clampRectToRotatedBounds(next, {
        width,
        height,
        angle: rotationAngle,
        scale: rotationScale,
      })
    },
    [height, rotationAngle, rotationScale, width]
  )

  useEffect(() => {
    const clamped = clampWithRotation(rect)
    if (!rectEquals(clamped, rect)) {
      onChange(clamped)
    }
  }, [clampWithRotation, onChange, rect])

  const updateDrag = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      event.preventDefault()
      if (!width || !height) return
      const deltaX = drag.widthPx ? (event.clientX - drag.startX) / drag.widthPx : 0
      const deltaY = drag.heightPx ? (event.clientY - drag.startY) / drag.heightPx : 0
      const proposed =
        drag.type === 'move'
          ? moveRect(drag.startRect, deltaX, deltaY)
          : resizeRect(drag.type, drag.startRect, deltaX, deltaY, aspectRatio, containerRatio)
      onChange(clampWithRotation(proposed))
    },
    [aspectRatio, clampWithRotation, containerRatio, height, onChange, width]
  )

  const endDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    setActiveHandle(null)
    setIsHoveringFrame(false)
    setHoverHandle(null)
  }, [])

  const renderCornerHandle = useCallback(
    (type: Exclude<HandleType, 'move' | 'n' | 's' | 'e' | 'w'>, position: { x: number; y: number }) => {
      const baseSize = 14
      const size = Math.max(8, baseSize * handleScale)
      return (
        <div
          key={type}
          className="absolute z-10 rounded-full border border-white bg-[rgba(0,0,0,0.4)]"
          style={{
            width: size,
            height: size,
            left: `${position.x * 100}%`,
            top: `${position.y * 100}%`,
            transform: `translate(-50%, -50%) scale(${handleScale})`,
            transformOrigin: 'center',
            cursor: HANDLE_CURSORS[type],
            pointerEvents: 'auto',
          }}
          onPointerDown={(event) => startDrag(type, event)}
          onPointerMove={updateDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onPointerEnter={() => setHoverHandle(type)}
          onPointerLeave={() =>
            setHoverHandle((current) => (current === type ? null : current))
          }
        />
      )
    },
    [endDrag, handleScale, setHoverHandle, startDrag, updateDrag]
  )

  const renderEdgeHandleNode = useCallback(
    (type: Extract<HandleType, 'n' | 's' | 'e' | 'w'>, position: { x: number; y: number }) => {
      const isHorizontal = type === 'n' || type === 's'
      const baseWidth = isHorizontal ? 24 : 12
      const baseHeight = isHorizontal ? 12 : 24
      const width = Math.max(8, baseWidth * handleScale)
      const height = Math.max(8, baseHeight * handleScale)
      return (
        <div
          key={type}
          className="absolute z-10 rounded-full border border-white bg-[rgba(0,0,0,0.4)]"
          style={{
            width,
            height,
            left: `${position.x * 100}%`,
            top: `${position.y * 100}%`,
            transform: `translate(-50%, -50%) scale(${handleScale})`,
            transformOrigin: 'center',
            cursor: HANDLE_CURSORS[type],
            pointerEvents: 'auto',
          }}
          onPointerDown={(event) => startDrag(type, event)}
          onPointerMove={updateDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onPointerEnter={() => setHoverHandle(type)}
          onPointerLeave={() =>
            setHoverHandle((current) => (current === type ? null : current))
          }
        />
      )
    },
    [endDrag, handleScale, setHoverHandle, startDrag, updateDrag]
  )

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
          cursor:
            activeHandle === 'move'
              ? 'grabbing'
              : hoverHandle && hoverHandle !== 'move'
                ? HANDLE_CURSORS[hoverHandle as Exclude<HandleType, 'move'>]
                : isHoveringFrame
                  ? 'grab'
                  : 'default',
        }}
        onPointerDown={(event) => startDrag('move', event)}
        onPointerMove={updateDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerEnter={() => setIsHoveringFrame(true)}
        onPointerLeave={() => setIsHoveringFrame(false)}
      >
        <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3">
          {Array.from({ length: 9 }).map((_, index) => (
            <div
              key={`grid-${index}`}
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

      <div
        className="absolute"
        style={{ left, top, width: cropWidth, height: cropHeight, pointerEvents: 'none' }}
      >
        {(['nw', 'ne', 'sw', 'se'] as const).map((key) =>
          renderCornerHandle(key, cornerPositions[key])
        )}
        {(['n', 's', 'w', 'e'] as const).map((key) =>
          renderEdgeHandleNode(key, edgePositions[key])
        )}
      </div>
    </div>
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
  aspectRatio: number | null,
  containerRatio: number
): CropRect {
  const next = resizeFree(type, rect, dx, dy)
  if (!aspectRatio) return next
  return fitToRatio(type, next, aspectRatio, containerRatio)
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
  aspectRatio: number,
  containerRatio: number
): CropRect {
  const anchor = HANDLE_ANCHORS[type]
  const width = rect.width
  const height = rect.height
  const ratioBase = containerRatio > 0 ? containerRatio : 1
  const target = fitRectToAspect({ ...rect, width, height }, aspectRatio, MIN_CROP_EDGE, ratioBase)
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

function clampRectToRotatedBounds(
  rect: CropRect,
  bounds: { width: number; height: number; angle: number; scale: number }
): CropRect {
  const { width, height, angle, scale } = bounds
  if (!width || !height) return clampCropRect(rect)
  const radians = ((angle ?? 0) * Math.PI) / 180
  const sin = Math.sin(radians)
  const cos = Math.cos(radians)
  const centerX = width / 2
  const centerY = height / 2
  const halfImageWidth = (width * scale) / 2
  const halfImageHeight = (height * scale) / 2

  let next = clampCropRect(rect)
  const applyScaleLimit = () => {
    const rectWidthPx = next.width * width
    const rectHeightPx = next.height * height
    const boundingWidth = Math.abs(rectWidthPx * cos) + Math.abs(rectHeightPx * sin)
    const boundingHeight = Math.abs(rectWidthPx * sin) + Math.abs(rectHeightPx * cos)
    const maxWidth = halfImageWidth * 2
    const maxHeight = halfImageHeight * 2
    const scaleX = maxWidth / (boundingWidth || 1)
    const scaleY = maxHeight / (boundingHeight || 1)
    const limit = Math.min(scaleX, scaleY, 1)
    if (limit >= 1 - 1e-4) return
    const newWidth = next.width * limit
    const newHeight = next.height * limit
    const centerRectX = next.x + next.width / 2
    const centerRectY = next.y + next.height / 2
    next = clampCropRect({
      x: centerRectX - newWidth / 2,
      y: centerRectY - newHeight / 2,
      width: newWidth,
      height: newHeight,
    })
  }

  applyScaleLimit()
  for (let iteration = 0; iteration < 5; iteration += 1) {
    const corners = getRectCorners(next, width, height)
    let adjustX = 0
    let adjustY = 0
    let violations = 0
    corners.forEach((corner) => {
      const dx = corner.x - centerX
      const dy = corner.y - centerY
      const localX = dx * cos + dy * sin
      const localY = -dx * sin + dy * cos
      const clampedLocalX = clamp(localX, -halfImageWidth, halfImageWidth)
      const clampedLocalY = clamp(localY, -halfImageHeight, halfImageHeight)
      if (clampedLocalX !== localX || clampedLocalY !== localY) {
        const correctedDx = clampedLocalX * cos - clampedLocalY * sin
        const correctedDy = clampedLocalX * sin + clampedLocalY * cos
        adjustX += correctedDx - dx
        adjustY += correctedDy - dy
        violations += 1
      }
    })
    if (!violations) break
    const offsetX = (adjustX / violations) / width
    const offsetY = (adjustY / violations) / height
    next = clampCropRect({
      ...next,
      x: next.x + offsetX,
      y: next.y + offsetY,
    })
    applyScaleLimit()
  }
  return next
}

function getRectCorners(rect: CropRect, width: number, height: number) {
  const px = rect.x * width
  const py = rect.y * height
  const rectWidth = rect.width * width
  const rectHeight = rect.height * height
  return [
    { x: px, y: py },
    { x: px + rectWidth, y: py },
    { x: px + rectWidth, y: py + rectHeight },
    { x: px, y: py + rectHeight },
  ]
}

function rectEquals(a: CropRect, b: CropRect): boolean {
  const epsilon = 0.0001
  return (
    Math.abs(a.x - b.x) < epsilon &&
    Math.abs(a.y - b.y) < epsilon &&
    Math.abs(a.width - b.width) < epsilon &&
    Math.abs(a.height - b.height) < epsilon
  )
}
