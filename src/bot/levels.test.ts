import { describe, expect, it } from 'vitest'
import type { AnalyseOptions, Engine } from '../engine/stockfish'
import { botMove, BOT_LEVELS, fromUci, levelInfo, toUci } from './levels'

// Máy giả: ghi lại câu hỏi, trả về nước định sẵn.
function fakeEngine(bestmove: string | null) {
  const calls: { fen: string; options: AnalyseOptions }[] = []
  const engine = {
    analyse: async (fen: string, options: AnalyseOptions = {}) => {
      calls.push({ fen, options })
      return { bestmove, depth: 1, lines: [] }
    },
  } as unknown as Engine
  return { engine, calls }
}

describe('máy chọn nước', () => {
  it('hỏi máy với cả ván và đúng mức', async () => {
    const { engine, calls } = fakeEngine('g8f6')
    const level = levelInfo(4)
    expect(await botMove(engine, ['e2e4', 'e7e5', 'g1f3'], level, undefined, () => 0.99)).toBe('g8f6')
    expect(calls[0].options).toMatchObject({ moves: ['e2e4', 'e7e5', 'g1f3'], skill: level.skill, depth: level.depth })
  })

  it('mức thấp nhất đôi khi đi bừa một nước hợp lệ, không hỏi máy', async () => {
    const { engine, calls } = fakeEngine('e2e4')
    const move = await botMove(engine, [], levelInfo(1), undefined, () => 0)
    expect(calls).toHaveLength(0)
    expect(move).toMatch(/^[a-h][1-8][a-h][1-8]$/)
  })

  it('hết nước (bị chiếu bí) thì trả null', async () => {
    const { engine } = fakeEngine(null)
    // Chiếu bí nhanh nhất: 1. f3 e5 2. g4 Qh4#
    expect(await botMove(engine, ['f2f3', 'e7e5', 'g2g4', 'd8h4'], levelInfo(3))).toBeNull()
  })

  it('máy trả nước lạ thì vẫn đi một nước hợp lệ', async () => {
    const { engine } = fakeEngine('a1a8')
    const move = await botMove(engine, [], levelInfo(3))
    expect(move).not.toBe('a1a8')
    expect(move).toMatch(/^[a-h][1-8][a-h][1-8]$/)
  })

  it('các mức xếp từ dễ tới khó', () => {
    for (let i = 1; i < BOT_LEVELS.length; i++) {
      expect(BOT_LEVELS[i].skill).toBeGreaterThanOrEqual(BOT_LEVELS[i - 1].skill)
      expect(BOT_LEVELS[i].depth).toBeGreaterThan(BOT_LEVELS[i - 1].depth)
      expect(BOT_LEVELS[i].random).toBeLessThanOrEqual(BOT_LEVELS[i - 1].random)
    }
  })

  it('đổi qua lại dạng nước UCI', () => {
    expect(fromUci('e7e8q')).toEqual({ from: 'e7', to: 'e8', promotion: 'q' })
    expect(toUci({ from: 'e2', to: 'e4' })).toBe('e2e4')
  })
})
