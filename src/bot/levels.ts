// Cấp độ của máy khi chơi với máy, chọn bằng thanh trượt Elo (như mục "Engine" của chess.com): 200..3100, mỗi nấc 100,
// nấc cuối cùng là Impossible (máy đánh hết sức, nghĩ lâu hơn). Mỗi khoảng Elo có tên cấp độ (Dễ, Trung bình...).
// Stockfish mạnh hơn mọi người chơi, nên phải "bó tay" máy lại:
// - Từ 1320 Elo trở lên: dùng núm UCI_Elo có sẵn của Stockfish (nó chỉ nhận 1320..3190).
// - Dưới 1320: máy ở trình độ yếu nhất (Skill Level 0), nhìn trước ít nước, và thỉnh thoảng cố tình chọn nước kém:
//   + "nước kém": một nước khác trong mấy nước máy nghĩ ra (giống người chơi kém: thấy nước nhưng chọn sai);
//   + "đi bừa": một nước hợp lệ bất kỳ (chỉ hay gặp ở mức rất thấp, để người mới tập thắng được).
//   Elo càng thấp thì càng hay sai. Hai tỉ lệ này là ước lượng, chưa đo bằng cách cho máy đấu nhau.
// Đổi độ khó thì sửa các con số trong `eloPlan`.
import { Chess, type Move } from 'chess.js'
import { ENGINE_ELO_MAX, ENGINE_ELO_MIN, type Analysis, type Engine } from '../engine/stockfish'

export const ELO_MIN = 200
export const ELO_STEP = 100
// Nấc cuối thanh trượt: Impossible. Giá trị chỉ để đánh dấu, ngoài màn hình hiện IMPOSSIBLE_LABEL.
export const ELO_MAX = 3200
export const IMPOSSIBLE_LABEL = '3400+'
export const DEFAULT_ELO = 1000

// Nấc cao nhất còn dưới khoảng Stockfish tự bó sức được.
const WEAK_TOP = Math.floor((ENGINE_ELO_MIN - 1 - ELO_MIN) / ELO_STEP) * ELO_STEP + ELO_MIN

// Tên cấp độ theo khoảng Elo: mỗi cấp tính từ `from` trở lên.
export const TIERS = [
  { from: ELO_MIN, name: 'Dễ' },
  { from: 800, name: 'Trung bình' },
  { from: 1400, name: 'Khá' },
  { from: 1900, name: 'Giỏi' },
  { from: 2400, name: 'Cao thủ' },
  { from: ELO_MAX, name: 'Impossible' },
] as const

export function isImpossible(elo: number): boolean {
  return clampElo(elo) >= ELO_MAX
}

export function tierName(elo: number): string {
  const value = clampElo(elo)
  return [...TIERS].reverse().find((tier) => value >= tier.from)!.name
}

// Số Elo để hiện ra (nấc Impossible hiện 3400+).
export function eloLabel(elo: number): string {
  return isImpossible(elo) ? IMPOSSIBLE_LABEL : String(clampElo(elo))
}

// Cách máy nghĩ ở một mức Elo.
export type EloPlan = {
  elo?: number // gửi cho Stockfish (UCI_Elo); không có thì dùng `skill`
  skill: number // trình độ 0..20 của Stockfish
  depth?: number
  movetime: number
  multipv: number // cần mấy nước để có chỗ chọn nước kém
  mistake: number // 0..1: tỉ lệ chọn một nước kém hơn trong mấy nước máy nghĩ ra
  blunder: number // 0..1: tỉ lệ đi bừa một nước hợp lệ bất kỳ
}

// Đưa số bất kỳ về nấc gần nhất trên thanh trượt.
export function clampElo(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_ELO
  const stepped = Math.round((value - ELO_MIN) / ELO_STEP) * ELO_STEP + ELO_MIN
  return Math.max(ELO_MIN, Math.min(ELO_MAX, stepped))
}

export function eloPlan(rawElo: number): EloPlan {
  const elo = clampElo(rawElo)
  // Impossible: không bó gì cả, nghĩ 3 giây mỗi nước.
  if (elo >= ELO_MAX) return { skill: 20, movetime: 3000, multipv: 1, mistake: 0, blunder: 0 }
  if (elo >= ENGINE_ELO_MIN) {
    // Mạnh hơn thì cho nghĩ lâu hơn một chút (0,4 giây tới 1,2 giây).
    const t = (Math.min(elo, ENGINE_ELO_MAX) - ENGINE_ELO_MIN) / (ENGINE_ELO_MAX - ENGINE_ELO_MIN)
    return { elo, skill: 20, movetime: Math.round(400 + 800 * t), multipv: 1, mistake: 0, blunder: 0 }
  }
  // weak: 0 ở 1300 (gần mức Stockfish tự làm được), 1 ở 200 (yếu nhất).
  const weak = (WEAK_TOP - elo) / (WEAK_TOP - ELO_MIN)
  return {
    skill: 0,
    depth: Math.max(1, Math.round(1 + 7 * (1 - weak))),
    movetime: 300,
    multipv: 6,
    mistake: round2(0.05 + 0.4 * weak),
    blunder: round2(0.35 * weak * weak),
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

// Mức cũ (6 nút, trước khi có thanh trượt) đổi sang số Elo gần đúng, để ai đã chọn mức thì giữ được độ khó quen.
const OLD_LEVEL_ELO: Record<number, number> = { 1: 400, 2: 700, 3: 1000, 4: 1400, 5: 1900, 6: 2600 }

export function eloFromOldLevel(level: unknown): number | null {
  return typeof level === 'number' && OLD_LEVEL_ELO[level] ? OLD_LEVEL_ELO[level] : null
}

// Nước dạng UCI ('e7e8q') thành dạng bàn cờ dùng.
export function fromUci(uci: string): { from: Move['from']; to: Move['to']; promotion?: Move['promotion'] } {
  const promotion = uci[4] as Move['promotion'] | undefined
  return { from: uci.slice(0, 2) as Move['from'], to: uci.slice(2, 4) as Move['to'], ...(promotion ? { promotion } : {}) }
}

export function toUci(move: { from: string; to: string; promotion?: string }): string {
  return `${move.from}${move.to}${move.promotion ?? ''}`
}

// Từ kết quả máy nghĩ, chọn nước sẽ đi theo mức Elo (có thể cố tình chọn nước kém).
function pickMove(analysis: Analysis, plan: EloPlan, legal: string[], random: () => number): string {
  const best = analysis.bestmove && legal.includes(analysis.bestmove) ? analysis.bestmove : null
  const others = analysis.lines.map((line) => line.pv[0]).filter((uci): uci is string => !!uci && uci !== best && legal.includes(uci))
  if (others.length > 0 && plan.mistake > 0 && random() < plan.mistake) return others[Math.floor(random() * others.length)]
  // Máy trả về nước lạ (không nên xảy ra) thì đi nước hợp lệ đầu tiên, để ván không bị kẹt.
  return best ?? legal[0]
}

// Máy chọn một nước cho thế cờ sau các nước `moves` (dạng UCI, tính từ đầu ván). `random` để kiểm thử.
// Trả null khi hết nước hoặc bị huỷ.
export async function botMove(engine: Engine, moves: string[], elo: number, signal?: AbortSignal, random = Math.random): Promise<string | null> {
  const plan = eloPlan(elo)
  const chess = new Chess()
  for (const uci of moves) chess.move(fromUci(uci))
  const legal = chess.moves({ verbose: true }).map(toUci)
  if (legal.length === 0) return null
  if (plan.blunder > 0 && random() < plan.blunder) return legal[Math.floor(random() * legal.length)]
  const analysis = await engine.analyse(new Chess().fen(), {
    moves,
    skill: plan.skill,
    elo: plan.elo,
    depth: plan.depth,
    movetime: plan.movetime,
    multipv: plan.multipv,
    signal,
  })
  if (signal?.aborted) return null
  return pickMove(analysis, plan, legal, random)
}
