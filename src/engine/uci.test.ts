import { describe, expect, it } from 'vitest'
import { fenTurn, mergeLine, parseBestmove, parseInfo } from './uci'

describe('đọc chữ của Stockfish', () => {
  it('đọc điểm và đường đi, đổi sang góc nhìn Trắng', () => {
    const line = 'info depth 12 seldepth 18 multipv 1 score cp 35 nodes 1000 nps 50000 time 20 pv e2e4 e7e5 g1f3'
    expect(parseInfo(line, 'w')).toEqual({ multipv: 1, depth: 12, score: { cp: 35 }, pv: ['e2e4', 'e7e5', 'g1f3'] })
    // Đen tới lượt mà Đen hơn 35 thì theo góc nhìn Trắng là -35.
    expect(parseInfo(line, 'b')?.score).toEqual({ cp: -35 })
  })

  it('đọc chiếu bí và thứ hạng đường', () => {
    const line = 'info depth 20 multipv 2 score mate -3 pv h7h6 d8h4'
    expect(parseInfo(line, 'w')).toEqual({ multipv: 2, depth: 20, score: { mate: -3 }, pv: ['h7h6', 'd8h4'] })
    expect(parseInfo(line, 'b')?.score).toEqual({ mate: 3 })
  })

  it('bỏ các dòng không có điểm hay đường đi, và điểm tạm', () => {
    expect(parseInfo('info string NNUE evaluation using nn.nnue', 'w')).toBeNull()
    expect(parseInfo('info depth 5 currmove e2e4 currmovenumber 1', 'w')).toBeNull()
    expect(parseInfo('info depth 0 score mate 0', 'w')).toBeNull()
    expect(parseInfo('info depth 9 score cp 20 lowerbound nodes 10 pv e2e4', 'w')).toBeNull()
    expect(parseInfo('readyok', 'w')).toBeNull()
  })

  it('đọc nước máy chọn; hết nước thì null', () => {
    expect(parseBestmove('bestmove e7e8q ponder a2a3')).toEqual({ move: 'e7e8q' })
    expect(parseBestmove('bestmove (none)')).toEqual({ move: null })
    expect(parseBestmove('info depth 1')).toBeNull()
  })

  it('gộp đường theo thứ hạng', () => {
    const a = { multipv: 1, depth: 1, score: { cp: 1 }, pv: ['a2a3'] }
    const b = { multipv: 2, depth: 1, score: { cp: 0 }, pv: ['h2h3'] }
    const a2 = { ...a, depth: 2 }
    expect(mergeLine(mergeLine([], b), a)).toEqual([a, b])
    expect(mergeLine([a, b], a2)).toEqual([a2, b])
  })

  it('biết bên tới lượt trong FEN', () => {
    expect(fenTurn('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1')).toBe('b')
    expect(fenTurn('8/8/8/8/8/8/8/K6k w - - 0 1')).toBe('w')
  })
})
