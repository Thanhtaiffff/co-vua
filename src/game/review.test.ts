import { Chess } from 'chess.js'
import { describe, expect, it } from 'vitest'
import { classify, finalScore, formatScore, moveAccuracy, positions, reviewGame, winChance, type PositionEval } from './review'
import type { PlayedMove } from './rules'

describe('winChance', () => {
  it('cân bằng là 50, hơn một tốt khoảng 59, hơn một quân nhẹ khoảng 75', () => {
    expect(winChance({ cp: 0 })).toBe(50)
    expect(winChance({ cp: 100 })).toBeCloseTo(59.1, 0)
    expect(winChance({ cp: 300 })).toBeCloseTo(75.1, 0)
    expect(winChance({ cp: -300 })).toBeCloseTo(24.9, 0)
  })

  it('chiếu bí được là chắc thắng, hơn quá 10 tốt thì như nhau', () => {
    expect(winChance({ mate: 3 })).toBe(100)
    expect(winChance({ mate: -1 })).toBe(0)
    expect(winChance({ cp: 5000 })).toBe(winChance({ cp: 1000 }))
  })
})

describe('moveAccuracy', () => {
  it('không tụt là 100, tụt càng nhiều càng thấp', () => {
    expect(moveAccuracy(60, 60)).toBe(100)
    expect(moveAccuracy(60, 70)).toBe(100)
    expect(moveAccuracy(60, 50)).toBeCloseTo(64.6, 0)
    expect(moveAccuracy(80, 20)).toBeLessThan(10)
  })
})

describe('classify', () => {
  it('xếp loại theo số điểm khả năng thắng bị tụt', () => {
    expect(classify(0, true)).toBe('best')
    expect(classify(1, false)).toBe('excellent')
    expect(classify(3, false)).toBe('good')
    expect(classify(7, false)).toBe('inaccuracy')
    expect(classify(15, false)).toBe('mistake')
    expect(classify(40, false)).toBe('blunder')
  })
})

describe('formatScore', () => {
  it('viết điểm theo góc nhìn Trắng', () => {
    expect(formatScore({ cp: 130 })).toBe('+1.3')
    expect(formatScore({ cp: -42 })).toBe('−0.4')
    expect(formatScore({ cp: 2 })).toBe('0.0')
    expect(formatScore({ mate: 3 })).toBe('M3')
    expect(formatScore({ mate: -2 })).toBe('−M2')
  })
})

describe('finalScore', () => {
  it('bị chiếu bí thì bên kia thắng chắc; pat là hòa; ván chưa xong thì cần máy', () => {
    const mated = new Chess()
    for (const san of ['f3', 'e5', 'g4', 'Qh4#']) mated.move(san)
    expect(winChance(finalScore(mated)!)).toBe(0)
    expect(formatScore(finalScore(mated)!)).toBe('0-1')
    expect(finalScore(new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'))).toEqual({ cp: 0 })
    expect(finalScore(new Chess())).toBeNull()
  })
})

describe('reviewGame', () => {
  // Ván "chiếu bí ngốc": Trắng đi f3, g4 là hớ, Đen chiếu bí ngay.
  const moves: PlayedMove[] = [
    { from: 'f2', to: 'f3' },
    { from: 'e7', to: 'e5' },
    { from: 'g2', to: 'g4' },
    { from: 'd8', to: 'h4' },
  ]
  const evals: PositionEval[] = [
    { score: { cp: 30 }, best: 'e2e4' },
    { score: { cp: -60 }, best: 'e7e5' },
    { score: { cp: -50 }, best: 'e2e4' },
    { score: { mate: -1 }, best: 'd8h4' },
    { score: { mate: -0.5 }, best: null },
  ]

  it('xếp loại từng nước và đếm cho mỗi bên', () => {
    const review = reviewGame(moves, evals)
    expect(review.moves.map((m) => m.kind)).toEqual(['inaccuracy', 'best', 'blunder', 'best'])
    expect(review.moves[2].bestSan).toBe('e4')
    expect(review.moves[0].bestSan).toBe('e4')
    expect(review.sides.w.counts.blunder).toBe(1)
    expect(review.sides.b.counts.best).toBe(2)
    expect(review.sides.b.accuracy).toBeGreaterThan(95)
    expect(review.sides.w.accuracy).toBeLessThan(40)
    expect(review.win).toHaveLength(5)
  })

  it('đòi đủ điểm cho mọi thế cờ', () => {
    expect(() => reviewGame(moves, evals.slice(1))).toThrow()
  })

  it('positions trả thế cờ đầu ván và sau từng nước', () => {
    const fens = positions(moves)
    expect(fens).toHaveLength(5)
    expect(fens[0]).toBe(new Chess().fen())
  })
})
