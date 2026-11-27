import { useCallback, useEffect, useState } from 'react'

export type Review = {
  shown: number // bàn cờ đang hiện thế cờ sau nước thứ mấy (0 là lúc bắt đầu ván)
  reviewing: boolean // đang xem thế cờ cũ, không phải thế cờ hiện tại
  go: (ply: number) => void // tới thế cờ sau nước thứ `ply`; từ số nước hiện có trở lên là về thế cờ hiện tại
  reset: () => void // thôi xem lại, không kêu tiếng (vd. vừa đi nước mới từ thế cờ đang xem, số nước có thể không đổi)
}

// Trạng thái xem lại: `ply` là thế cờ đang xem (null là thế cờ hiện tại), `total` là số nước của ván lúc đó.
export type ReviewState = { total: number; ply: number | null }

// Số nước của ván vừa đổi (đi thêm, đi lại, ván mới) thì thôi xem lại, về thế cờ hiện tại.
// Phải xoá hẳn chỗ đang xem: chỉ so số nước thì đi lại một nước rồi đi tiếp, số nước trùng lại như cũ,
// bàn cờ quay về thế cờ cũ và giấu mất nước vừa đi.
export function syncReview(state: ReviewState, total: number): ReviewState {
  return state.total === total ? state : { total, ply: null }
}

// Bàn cờ đang hiện thế cờ sau nước thứ mấy.
export function shownPly(state: ReviewState, total: number): number {
  const { ply } = syncReview(state, total)
  return ply ?? total
}

// Tới thế cờ sau nước `ply`; từ số nước hiện có trở lên là về thế cờ hiện tại.
export function goReview(total: number, ply: number): ReviewState {
  const next = Math.max(0, Math.min(total, ply))
  return { total, ply: next === total ? null : next }
}

// Xem lại các nước đã đi: bấm một nước trong cột nước đi, hay dùng nút mũi tên, phím ← → (Home, End để về đầu, về cuối).
// Ván có thêm nước mới hay vừa đi lại (số nước đổi) thì tự về thế cờ hiện tại, để không lỡ lượt mình.
// `onStep(to, from)`: bàn cờ vừa đổi từ thế cờ sau nước `from` sang thế cờ sau nước `to` (để kêu tiếng, xem reviewSound.ts).
export function useReview(total: number, onStep?: (to: number, from: number) => void): Review {
  const [state, setState] = useState<ReviewState>({ total, ply: null })
  const synced = syncReview(state, total)
  // Cập nhật ngay trong lúc vẽ (React cho phép với state của chính mình), không đợi useEffect cho khỏi chớp thế cờ cũ.
  if (synced !== state) setState(synced)
  const shown = shownPly(synced, total)

  const go = useCallback(
    (ply: number) => {
      const next = goReview(total, ply)
      const to = next.ply ?? total
      if (to === shown) return
      onStep?.(to, shown)
      setState(next)
    },
    [total, shown, onStep],
  )

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      // Đang gõ chữ (ô tên), hay đang mở bảng chọn, thì phím mũi tên là của chỗ đó.
      const target = event.target instanceof Element ? event.target : null
      if (target?.closest('input, textarea, select, [contenteditable="true"], dialog')) return
      const keys: Record<string, number> = { ArrowLeft: shown - 1, ArrowRight: shown + 1, Home: 0, End: total }
      if (!(event.key in keys)) return
      event.preventDefault()
      go(keys[event.key])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, shown, total])

  const reset = useCallback(() => setState((prev) => ({ total: prev.total, ply: null })), [])

  return { shown, reviewing: shown < total, go, reset }
}

// Đưa bàn cờ vào tầm nhìn. Điện thoại: thẻ kết quả nằm dưới bàn cờ, bấm "Xem lại từng nước" thì cuộn lên cho thấy bàn.
export function showBoard(): void {
  const board = document.querySelector('.board-col')
  if (!board) return
  const rect = board.getBoundingClientRect()
  if (rect.top >= 0 && rect.bottom <= window.innerHeight) return
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  board.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' })
}
