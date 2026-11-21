import { describe, expect, it } from 'vitest'
import { droppedShare, isSlow } from './lite'

const smooth60 = Array.from({ length: 120 }, (_, i) => 16.7 + (i % 3) * 0.2)
const smooth120 = Array.from({ length: 240 }, () => 8.3)
// Máy chậm: cứ 3 khung thì 1 khung bị kéo dài gấp đôi, gấp ba
// Màn 120 Hz tự hạ xuống 60 Hz lúc ít chuyển động: vẫn mượt
const mixed120 = Array.from({ length: 240 }, (_, i) => (i % 2 ? 8.3 : 16.7))
const choppy = Array.from({ length: 120 }, (_, i) => (i % 3 === 0 ? 50 : 16.7))

describe('đo độ mượt', () => {
  it('màn 60 Hz và 120 Hz chạy đều thì không rớt khung nào', () => {
    expect(droppedShare(smooth60)).toBe(0)
    expect(droppedShare(smooth120)).toBe(0)
    expect(droppedShare(mixed120)).toBe(0)
  })

  it('đếm đúng phần khung bị rớt', () => {
    expect(droppedShare(choppy)).toBeCloseTo(1 / 3, 2)
  })

  it('ít mẫu quá thì chưa phán', () => {
    expect(droppedShare([50, 50, 16.7])).toBe(0)
  })

  it('chỉ coi là máy chậm khi đã chạm đủ số lần', () => {
    expect(isSlow(choppy, 3)).toBe(false)
    expect(isSlow(choppy, 8)).toBe(true)
    expect(isSlow(smooth60, 20)).toBe(false)
  })
})
