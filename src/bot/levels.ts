// Các mức của máy khi chơi với máy. Stockfish mạnh hơn mọi người chơi, nên phải "bó tay" máy lại bằng ba cách:
// - skill: trình độ 0..20 có sẵn của Stockfish (thấp thì máy cố tình chọn nước kém hơn nước tốt nhất);
// - depth / movetime: cho máy nhìn trước ít nước, nghĩ ít thời gian;
// - random: tỉ lệ máy đi bừa một nước hợp lệ bất kỳ (chỉ ở mức thấp nhất, để người mới tập thắng được).
// Đổi độ khó thì sửa các con số ở đây.
import { Chess, type Move } from 'chess.js'
import type { Engine } from '../engine/stockfish'

export type BotLevel = {
  id: number
  name: string
  skill: number
  depth: number
  movetime?: number
  random: number // 0..1
}

export const BOT_LEVELS: BotLevel[] = [
  { id: 1, name: 'Mới tập', skill: 0, depth: 1, random: 0.35 },
  { id: 2, name: 'Dễ', skill: 0, depth: 2, random: 0.1 },
  { id: 3, name: 'Vừa', skill: 4, depth: 5, random: 0 },
  { id: 4, name: 'Khá', skill: 9, depth: 8, random: 0 },
  { id: 5, name: 'Khó', skill: 15, depth: 12, movetime: 800, random: 0 },
  { id: 6, name: 'Cao thủ', skill: 20, depth: 20, movetime: 1500, random: 0 },
]

export const DEFAULT_LEVEL = 3

export function levelInfo(id: number): BotLevel {
  return BOT_LEVELS.find((level) => level.id === id) ?? BOT_LEVELS[DEFAULT_LEVEL - 1]
}

// Nước dạng UCI ('e7e8q') thành dạng bàn cờ dùng.
export function fromUci(uci: string): { from: Move['from']; to: Move['to']; promotion?: Move['promotion'] } {
  const promotion = uci[4] as Move['promotion'] | undefined
  return { from: uci.slice(0, 2) as Move['from'], to: uci.slice(2, 4) as Move['to'], ...(promotion ? { promotion } : {}) }
}

export function toUci(move: { from: string; to: string; promotion?: string }): string {
  return `${move.from}${move.to}${move.promotion ?? ''}`
}

// Máy chọn một nước cho thế cờ sau các nước `moves` (dạng UCI, tính từ đầu ván). `random` để kiểm thử.
// Trả null khi hết nước hoặc bị huỷ.
export async function botMove(engine: Engine, moves: string[], level: BotLevel, signal?: AbortSignal, random = Math.random): Promise<string | null> {
  const chess = new Chess()
  for (const uci of moves) chess.move(fromUci(uci))
  const legal = chess.moves({ verbose: true })
  if (legal.length === 0) return null
  if (level.random > 0 && random() < level.random) {
    const pick = legal[Math.floor(random() * legal.length)]
    return toUci(pick)
  }
  const analysis = await engine.analyse(new Chess().fen(), {
    moves,
    skill: level.skill,
    depth: level.depth,
    movetime: level.movetime,
    signal,
  })
  if (signal?.aborted) return null
  // Máy trả về nước lạ (không nên xảy ra) thì đi nước hợp lệ đầu tiên, để ván không bị kẹt.
  const best = analysis.bestmove
  return best && legal.some((m) => toUci(m) === best) ? best : toUci(legal[0])
}
