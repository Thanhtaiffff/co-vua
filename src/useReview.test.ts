import { describe, expect, it } from 'vitest'
import { goReview, shownPly, syncReview, type ReviewState } from './useReview'

// Mô phỏng hook useReview: mỗi lần vẽ thì đồng bộ với số nước của ván, như trong hook.
function render(state: ReviewState, total: number) {
  const synced = syncReview(state, total)
  return { state: synced, shown: shownPly(synced, total), reviewing: shownPly(synced, total) < total }
}

describe('xem lại nước đi', () => {
  it('lùi một nước rồi về lại thế cờ hiện tại', () => {
    let view = render({ total: 4, ply: null }, 4)
    expect(view.shown).toBe(4)
    view = render(goReview(4, 3), 4)
    expect(view).toMatchObject({ shown: 3, reviewing: true })
    view = render(goReview(4, 4), 4)
    expect(view).toMatchObject({ shown: 4, reviewing: false })
  })

  it('đang xem lại mà có nước mới thì về thế cờ hiện tại', () => {
    let view = render(goReview(4, 1), 4)
    view = render(view.state, 5)
    expect(view).toMatchObject({ shown: 5, reviewing: false })
  })

  // Lỗi cũ: đi 4 nước, lùi xem nước 3, bấm đi lại (còn 3 nước), đi nước mới (lại 4 nước)
  // thì bàn cờ vẫn kẹt ở thế cờ xem lại cũ, không hiện nước vừa đi.
  it('lùi xem, đi lại, rồi đi nước mới: bàn cờ hiện nước vừa đi', () => {
    let view = render({ total: 4, ply: null }, 4)
    view = render(goReview(4, 3), 4)
    view = render(view.state, 3) // bấm đi lại
    expect(view).toMatchObject({ shown: 3, reviewing: false })
    view = render(view.state, 4) // đi nước mới
    expect(view).toMatchObject({ shown: 4, reviewing: false })
  })

  it('máy: đi lại 2 nước rồi hai bên đi tiếp 2 nước, vẫn ở thế cờ hiện tại', () => {
    let view = render(goReview(6, 4), 6)
    view = render(view.state, 4)
    view = render(view.state, 5)
    view = render(view.state, 6)
    expect(view).toMatchObject({ shown: 6, reviewing: false })
  })

  it('không đi quá đầu ván hay quá nước cuối', () => {
    expect(shownPly(goReview(3, -2), 3)).toBe(0)
    expect(shownPly(goReview(3, 9), 3)).toBe(3)
  })
})
