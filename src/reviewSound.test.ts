import { describe, expect, it } from 'vitest'
import type { PlayedMove } from './game/rules'
import { reviewSounds } from './reviewSound'

// 1. e4 d5 2. exd5 Qxd5 3. Nf3 Qe4+ 4. Be2 Nc6 5. O-O
const moves: PlayedMove[] = [
  { from: 'e2', to: 'e4' },
  { from: 'd7', to: 'd5' },
  { from: 'e4', to: 'd5' },
  { from: 'd8', to: 'd5' },
  { from: 'g1', to: 'f3' },
  { from: 'd5', to: 'e4' },
  { from: 'f1', to: 'e2' },
  { from: 'b8', to: 'c6' },
  { from: 'e1', to: 'g1' },
]
const names = (from: number, to: number) => reviewSounds(moves, from, to).map(([name]) => name)

describe('tiếng khi xem lại nước đi', () => {
  it('tiến một nước: tiếng đầy đủ của nước đó, như lúc đi thật', () => {
    expect(names(0, 1)).toEqual(['move'])
    expect(names(2, 3)).toEqual(['capture'])
    expect(names(5, 6)).toEqual(['move', 'check'])
    expect(names(8, 9)).toEqual(['castle'])
  })

  it('lùi một nước: tiếng quân của nước vừa gỡ, không báo chiếu', () => {
    expect(names(3, 2)).toEqual(['capture'])
    expect(names(6, 5)).toEqual(['move'])
    expect(names(9, 8)).toEqual(['castle'])
    expect(names(1, 0)).toEqual(['move'])
  })

  it('nhảy tới một nước bất kỳ: tiếng của nước dẫn tới thế cờ đó', () => {
    expect(names(9, 4)).toEqual(['capture'])
    expect(names(0, 6)).toEqual(['move', 'check'])
    expect(names(1, 9)).toEqual(['castle'])
  })

  it('về đầu ván: một tiếng đi quân', () => {
    expect(names(7, 0)).toEqual(['move'])
  })

  it('đứng yên hay ngoài ván thì im', () => {
    expect(names(4, 4)).toEqual([])
    expect(names(4, 10)).toEqual([])
  })
})
