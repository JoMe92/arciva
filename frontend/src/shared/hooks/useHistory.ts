import { useState, useCallback, useMemo } from 'react'

export type HistoryItem<T> = {
    description: string
    undo: () => void
    redo: () => void
}

export type HistoryState<T> = {
    past: HistoryItem<T>[]
    future: HistoryItem<T>[]
}

export function useHistory<T>() {
    const [history, setHistory] = useState<HistoryState<T>>({
        past: [],
        future: [],
    })

    const canUndo = history.past.length > 0
    const canRedo = history.future.length > 0

    const push = useCallback((item: HistoryItem<T>) => {
        setHistory((prev) => ({
            past: [...prev.past, item],
            future: [],
        }))
    }, [])

    const undo = useCallback(() => {
        setHistory((prev) => {
            if (prev.past.length === 0) return prev
            const newPast = [...prev.past]
            const item = newPast.pop()!
            item.undo()
            return {
                past: newPast,
                future: [item, ...prev.future],
            }
        })
    }, [])

    const redo = useCallback(() => {
        setHistory((prev) => {
            if (prev.future.length === 0) return prev
            const newFuture = [...prev.future]
            const item = newFuture.shift()!
            item.redo()
            return {
                past: [...prev.past, item],
                future: newFuture,
            }
        })
    }, [])

    const clear = useCallback(() => {
        setHistory({ past: [], future: [] })
    }, [])

    return {
        push,
        undo,
        redo,
        canUndo,
        canRedo,
        clear,
    }
}
