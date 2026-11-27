import { describe, expect, it } from 'vitest'
import type { AnalyseOptions, Engine } from '../engine/stockfish'
import { botMove, clampElo, DEFAULT_ELO, eloFromOldLevel, eloLabel, eloPlan, ELO_MAX, ELO_MIN, ELO_STEP, fromUci, isImpossible, tierName, toUci } from './levels'

// Máy giả: ghi lại câu hỏi, trả về nước định sẵn.
function fakeEngine(bestmove: string | null, others: string[] = []) {
  const calls: { fen: string; options: AnalyseOptions }[] = []
  const lines = [bestmove, ...others].filter((m): m is string => !!m).map((move, i) => ({ multipv: i + 1, depth: 1, score: { cp: -i * 50 }, pv: [move] }))
  const engine = {
    analyse: async (fen: string, options: AnalyseOptions = {}) => {
      calls.push({ fen, options })
      return { bestmove, depth: 1, lines }
    },
  } as unknown as Engine
  return { engine, calls }
}

const steps = Array.from({ length: (ELO_MAX - ELO_MIN) / ELO_STEP + 1 }, (_, i) => ELO_MIN + i * ELO_STEP)

describe('mức Elo', () => {
  it('thanh trượt đi từ 200 tới 3100 rồi tới Impossible, mỗi nấc 100', () => {
    expect(steps[0]).toBe(200)
    expect(steps.at(-2)).toBe(3100)
    expect(steps.at(-1)).toBe(ELO_MAX)
    expect(clampElo(1012)).toBe(1000)
    expect(clampElo(1050)).toBe(1100)
    expect(clampElo(-5)).toBe(200)
    expect(clampElo(9999)).toBe(ELO_MAX)
    expect(clampElo(Number.NaN)).toBe(DEFAULT_ELO)
  })

  it('mỗi khoảng Elo có tên cấp độ, nấc cuối là Impossible', () => {
    expect(tierName(200)).toBe('Dễ')
    expect(tierName(700)).toBe('Dễ')
    expect(tierName(800)).toBe('Trung bình')
    expect(tierName(1400)).toBe('Khá')
    expect(tierName(1900)).toBe('Giỏi')
    expect(tierName(2400)).toBe('Cao thủ')
    expect(tierName(3100)).toBe('Cao thủ')
    expect(tierName(ELO_MAX)).toBe('Impossible')
    expect(isImpossible(3100)).toBe(false)
    expect(eloLabel(1500)).toBe('1500')
    expect(eloLabel(ELO_MAX)).toBe('3400+')
  })

  it('từ 1320 trở lên dùng núm Elo của Stockfish, Impossible không bó sức và nghĩ lâu nhất', () => {
    expect(eloPlan(1300).elo).toBeUndefined()
    expect(eloPlan(1400)).toMatchObject({ elo: 1400, mistake: 0, blunder: 0 })
    expect(eloPlan(3100).elo).toBe(3100)
    expect(eloPlan(ELO_MAX).elo).toBeUndefined()
    expect(eloPlan(ELO_MAX)).toMatchObject({ skill: 20, mistake: 0, blunder: 0 })
    expect(eloPlan(ELO_MAX).movetime).toBeGreaterThan(eloPlan(3100).movetime)
  })

  it('Elo càng cao máy càng ít sai, nhìn càng sâu, nghĩ càng lâu', () => {
    for (let i = 1; i < steps.length; i++) {
      const weaker = eloPlan(steps[i - 1])
      const stronger = eloPlan(steps[i])
      expect(stronger.mistake).toBeLessThanOrEqual(weaker.mistake)
      expect(stronger.blunder).toBeLessThanOrEqual(weaker.blunder)
      expect(stronger.movetime).toBeGreaterThanOrEqual(weaker.movetime)
      if (weaker.depth && stronger.depth) expect(stronger.depth).toBeGreaterThanOrEqual(weaker.depth)
      if (weaker.elo && stronger.elo) expect(stronger.elo).toBeGreaterThan(weaker.elo)
    }
    expect(eloPlan(200).blunder).toBeGreaterThan(0.3)
    expect(eloPlan(1300).blunder).toBe(0)
  })

  it('mức cũ (6 nút) đổi sang Elo gần đúng', () => {
    expect(eloFromOldLevel(1)).toBe(400)
    expect(eloFromOldLevel(3)).toBe(1000)
    expect(eloFromOldLevel(6)).toBe(2600)
    expect(eloFromOldLevel(9)).toBeNull()
    expect(eloFromOldLevel('3')).toBeNull()
  })
})

describe('máy chọn nước', () => {
  it('hỏi máy với cả ván và đúng mức Elo', async () => {
    const { engine, calls } = fakeEngine('g8f6')
    expect(await botMove(engine, ['e2e4', 'e7e5', 'g1f3'], 1800, undefined, () => 0.99)).toBe('g8f6')
    expect(calls[0].options).toMatchObject({ moves: ['e2e4', 'e7e5', 'g1f3'], elo: 1800 })
  })

  it('Impossible không bó sức máy', async () => {
    const { engine, calls } = fakeEngine('e2e4')
    await botMove(engine, [], ELO_MAX, undefined, () => 0.99)
    expect(calls[0].options.skill).toBe(20)
    expect(calls[0].options.elo).toBeUndefined()
  })

  it('mức thấp đôi khi đi bừa một nước hợp lệ, không hỏi máy', async () => {
    const { engine, calls } = fakeEngine('e2e4')
    const move = await botMove(engine, [], 200, undefined, () => 0)
    expect(calls).toHaveLength(0)
    expect(move).toMatch(/^[a-h][1-8][a-h][1-8]$/)
  })

  it('mức thấp đôi khi chọn nước kém hơn trong mấy nước máy nghĩ ra', async () => {
    const { engine, calls } = fakeEngine('e2e4', ['d2d4', 'a2a3'])
    // Lần bốc đầu (đi bừa) trượt, lần sau (chọn nước kém) trúng, rồi bốc nước thứ hai trong các nước kém.
    const rolls = [0.99, 0, 0.6]
    const move = await botMove(engine, [], 600, undefined, () => rolls.shift() ?? 0)
    expect(calls[0].options.multipv).toBeGreaterThan(1)
    expect(move).toBe('a2a3')
  })

  it('không bốc trúng thì đi nước tốt nhất', async () => {
    const { engine } = fakeEngine('e2e4', ['d2d4'])
    expect(await botMove(engine, [], 600, undefined, () => 0.99)).toBe('e2e4')
  })

  it('hết nước (bị chiếu bí) thì trả null', async () => {
    const { engine } = fakeEngine(null)
    // Chiếu bí nhanh nhất: 1. f3 e5 2. g4 Qh4#
    expect(await botMove(engine, ['f2f3', 'e7e5', 'g2g4', 'd8h4'], 1000)).toBeNull()
  })

  it('máy trả nước lạ thì vẫn đi một nước hợp lệ', async () => {
    const { engine } = fakeEngine('a1a8')
    const move = await botMove(engine, [], 1800)
    expect(move).not.toBe('a1a8')
    expect(move).toMatch(/^[a-h][1-8][a-h][1-8]$/)
  })

  it('đổi qua lại dạng nước UCI', () => {
    expect(fromUci('e7e8q')).toEqual({ from: 'e7', to: 'e8', promotion: 'q' })
    expect(toUci({ from: 'e2', to: 'e4' })).toBe('e2e4')
  })
})
