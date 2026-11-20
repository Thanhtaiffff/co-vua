// Chấm từng nước sau ván (kiểu "Game Review" của chess.com, "Phân tích" của lichess). Máy (Stockfish) cho điểm từng thế
// cờ; file này chỉ làm toán trên các điểm đó, không gọi máy: đổi điểm ra "khả năng thắng", so trước và sau mỗi nước để
// biết nước đó làm mình tụt bao nhiêu, rồi xếp loại (tốt nhất, xuất sắc, tốt, thiếu chính xác, sai lầm, hớ nặng) và
// tính độ chính xác cả ván cho mỗi bên.
import { Chess, type Color } from 'chess.js'
import type { PlayedMove } from './rules'

// Điểm máy cho một thế cờ, LUÔN theo góc nhìn Trắng: cp là phần trăm tốt (100 = hơn một tốt), mate là chiếu bí sau
// bao nhiêu nước (dương: Trắng chiếu bí được, âm: Đen chiếu bí được).
export type Score = { cp: number } | { mate: number }

// Kết quả máy xem một thế cờ: điểm và nước máy cho là hay nhất (dạng UCI, vd "e2e4", "e7e8q"; null khi hết nước).
export type PositionEval = { score: Score; best: string | null }

export type MoveClass = 'best' | 'excellent' | 'good' | 'inaccuracy' | 'mistake' | 'blunder'

export type MoveReview = {
  ply: number // nước thứ mấy (1 là nước đầu của Trắng)
  color: Color // bên đi nước này
  uci: string // nước đã đi
  best: string | null // nước máy chọn ở thế cờ trước đó
  bestSan: string | null // như trên, viết kiểu ký hiệu cờ (Nf3...)
  loss: number // khả năng thắng của bên đi tụt bao nhiêu điểm phần trăm (0–100), không âm
  accuracy: number // độ chính xác của riêng nước này (0–100)
  kind: MoveClass
}

export type SideReview = { accuracy: number; counts: Record<MoveClass, number> }

export type GameReview = {
  win: number[] // khả năng thắng của Trắng (0–100) ở từng thế cờ, từ đầu ván (phần tử 0) tới sau nước cuối
  scores: Score[] // điểm máy từng thế cờ, cùng thứ tự với `win`
  moves: MoveReview[]
  sides: Record<Color, SideReview>
}

export const MOVE_CLASSES: MoveClass[] = ['best', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder']

// Ngưỡng xếp loại, tính bằng số điểm phần trăm khả năng thắng bị tụt sau nước đi. Lấy theo cách chia của chess.com
// (0,02 / 0,05 / 0,10 / 0,20 "điểm kỳ vọng"); lichess dễ hơn (10 / 20 / 30).
export const THRESHOLDS: Record<Exclude<MoveClass, 'best'>, number> = {
  excellent: 2,
  good: 5,
  inaccuracy: 10,
  mistake: 20,
  blunder: Infinity,
}

// Hơn kém quá 10 tốt thì coi như nhau (đằng nào cũng thắng/thua chắc), như lichess.
const CP_CAP = 1000

// Khả năng thắng (0–100) của Trắng ứng với điểm máy. Công thức lichess dựng từ hàng triệu ván thật: hơn 1 tốt ≈ 59%,
// hơn 3 tốt (một quân nhẹ) ≈ 75%. Chiếu bí được thì 100.
export function winChance(score: Score): number {
  if ('mate' in score) return score.mate > 0 ? 100 : score.mate < 0 ? 0 : 50
  const cp = Math.max(-CP_CAP, Math.min(CP_CAP, score.cp))
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1)
}

// Độ chính xác một nước, theo công thức lichess: không tụt là 100, tụt 10 điểm ≈ 65, tụt 30 ≈ 26.
export function moveAccuracy(before: number, after: number): number {
  if (after >= before) return 100
  const raw = 103.1668100711649 * Math.exp(-0.04354415386753951 * (before - after)) - 3.166924740191411
  return Math.max(0, Math.min(100, raw + 1))
}

export function classify(loss: number, isBest: boolean): MoveClass {
  if (isBest) return 'best'
  if (loss < THRESHOLDS.excellent) return 'excellent'
  if (loss < THRESHOLDS.good) return 'good'
  if (loss < THRESHOLDS.inaccuracy) return 'inaccuracy'
  if (loss < THRESHOLDS.mistake) return 'mistake'
  return 'blunder'
}

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

function stdDev(values: number[]): number {
  const m = mean(values)
  return Math.sqrt(mean(values.map((v) => (v - m) ** 2)))
}

// Độ chính xác cả ván của một bên, cách lichess: trung bình của (1) trung bình có trọng số, đoạn ván giằng co (khả
// năng thắng lên xuống mạnh) nặng ký hơn, và (2) trung bình điều hòa, để vài nước hớ kéo điểm xuống rõ.
export function sideAccuracy(win: number[], moves: MoveReview[], color: Color): number {
  const mine = moves.filter((m) => m.color === color)
  if (mine.length === 0) return 0
  const size = Math.max(2, Math.min(8, Math.floor(moves.length / 10)))
  const weight = (ply: number) => {
    // Cửa sổ `size` thế cờ quanh nước này (lấy đủ ở đầu ván), đo độ lên xuống.
    const end = Math.min(win.length, Math.max(size, ply + 1))
    const window = win.slice(end - size, end)
    return Math.max(0.5, Math.min(12, stdDev(window)))
  }
  const weights = mine.map((m) => weight(m.ply))
  const weighted = mine.reduce((sum, m, i) => sum + m.accuracy * weights[i], 0) / weights.reduce((a, b) => a + b, 0)
  const harmonic = mine.length / mine.reduce((sum, m) => sum + 1 / Math.max(m.accuracy, 1), 0)
  return (weighted + harmonic) / 2
}

export function toUci(move: { from: string; to: string; promotion?: string }): string {
  return move.from + move.to + (move.promotion ?? '')
}

function uciToSan(fen: string, uci: string | null): string | null {
  if (!uci) return null
  try {
    return new Chess(fen).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san
  } catch {
    return null
  }
}

// Điểm của thế cờ đã hết ván (máy không cho điểm): bị chiếu bí thì bên kia thắng chắc, các kiểu hòa là 0.
export function finalScore(chess: Chess): Score | null {
  if (chess.isCheckmate()) return { mate: chess.turn() === 'w' ? -0.5 : 0.5 }
  if (chess.isDraw()) return { cp: 0 }
  return null
}

// Các thế cờ cần máy xem: đầu ván và sau từng nước.
export function positions(moves: PlayedMove[]): string[] {
  const chess = new Chess()
  const fens = [chess.fen()]
  for (const move of moves) {
    chess.move(move)
    fens.push(chess.fen())
  }
  return fens
}

// Chấm cả ván từ điểm máy cho từng thế cờ (`evals[i]` là thế cờ sau `i` nước).
export function reviewGame(moves: PlayedMove[], evals: PositionEval[]): GameReview {
  if (evals.length !== moves.length + 1) throw new Error('Thiếu điểm máy cho một số thế cờ')
  const fens = positions(moves)
  const win = evals.map((e) => winChance(e.score))
  const reviews: MoveReview[] = moves.map((move, i) => {
    const color: Color = i % 2 === 0 ? 'w' : 'b'
    const uci = toUci(move)
    const best = evals[i].best
    // Khả năng thắng của chính bên đi, trước và sau nước đi.
    const before = color === 'w' ? win[i] : 100 - win[i]
    const after = color === 'w' ? win[i + 1] : 100 - win[i + 1]
    const loss = Math.max(0, before - after)
    return {
      ply: i + 1,
      color,
      uci,
      best,
      bestSan: uciToSan(fens[i], best),
      loss,
      accuracy: moveAccuracy(before, after),
      kind: classify(loss, best === uci),
    }
  })
  const side = (color: Color): SideReview => {
    const counts = Object.fromEntries(MOVE_CLASSES.map((k) => [k, 0])) as Record<MoveClass, number>
    for (const m of reviews) if (m.color === color) counts[m.kind]++
    return { accuracy: sideAccuracy(win, reviews, color), counts }
  }
  return { win, scores: evals.map((e) => e.score), moves: reviews, sides: { w: side('w'), b: side('b') } }
}

// Điểm máy viết gọn cho người xem, theo góc nhìn Trắng: "+1.3", "−0.4", "0.0", "M3" (Trắng chiếu bí sau 3 nước),
// "−M2" (Đen chiếu bí sau 2 nước), "1-0"/"0-1" khi đã chiếu bí.
export function formatScore(score: Score): string {
  if ('mate' in score) {
    if (Math.abs(score.mate) < 1) return score.mate > 0 ? '1-0' : '0-1'
    return `${score.mate > 0 ? '' : '−'}M${Math.abs(score.mate)}`
  }
  const pawns = score.cp / 100
  if (Math.abs(pawns) < 0.05) return '0.0'
  return `${pawns > 0 ? '+' : '−'}${Math.abs(pawns).toFixed(1)}`
}
