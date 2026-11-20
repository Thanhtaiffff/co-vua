// Cách hiện kết quả máy chấm ván: tên, ký hiệu, màu của từng loại nước, và những gì vẽ thêm lên bàn cờ (ký hiệu ở góc
// ô vừa đi tới, mũi tên nước máy chọn khi nước đã đi chưa phải hay nhất).
import type { DrawShape } from '@lichess-org/chessground/draw'
import type { Key } from '@lichess-org/chessground/types'
import type { GameReview, MoveClass } from './game/review'

export type ClassMeta = { label: string; glyph: string; color: string }

export const CLASS_META: Record<MoveClass, ClassMeta> = {
  best: { label: 'Tốt nhất', glyph: '★', color: '#5aa83a' },
  excellent: { label: 'Xuất sắc', glyph: '!', color: '#3f9e7a' },
  good: { label: 'Tốt', glyph: '✓', color: '#6f8f80' },
  inaccuracy: { label: 'Thiếu chính xác', glyph: '?!', color: '#e0a91b' },
  mistake: { label: 'Sai lầm', glyph: '?', color: '#e6812b' },
  blunder: { label: 'Hớ nặng', glyph: '??', color: '#d43c33' },
}

// Ba loại nước dở được đánh dấu cả trong cột nước đi; các loại còn lại chỉ hiện trên bàn cờ, để cột nước đi khỏi rối.
export const FLAGGED: MoveClass[] = ['inaccuracy', 'mistake', 'blunder']

// Ký hiệu cạnh mỗi nước trong cột nước đi (null là không đánh dấu).
export function moveMarks(review: GameReview | null): (MoveClass | null)[] | undefined {
  if (!review) return undefined
  return review.moves.map((m) => (FLAGGED.includes(m.kind) ? m.kind : null))
}

// Vòng tròn có ký hiệu, nằm ở góc trên bên phải ô (ô vuông rộng 100, gốc toạ độ ở góc trên bên trái ô).
function badge(kind: MoveClass): string {
  const { glyph, color } = CLASS_META[kind]
  const size = glyph.length > 1 ? 15 : 19
  return (
    `<circle cx="80" cy="20" r="17" fill="${color}" stroke="#fff" stroke-width="3"/>` +
    `<text x="80" y="20" dy="0.36em" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="800" font-size="${size}" fill="#fff">${glyph}</text>`
  )
}

// Hình vẽ thêm lên bàn cờ khi đang xem thế cờ sau nước `shown`.
export function reviewShapes(review: GameReview | null, shown: number): DrawShape[] {
  const move = review?.moves[shown - 1]
  if (!move) return []
  const to = move.uci.slice(2, 4) as Key
  const shapes: DrawShape[] = []
  if (move.kind !== 'best' && move.best) {
    shapes.push({ orig: move.best.slice(0, 2) as Key, dest: move.best.slice(2, 4) as Key, brush: 'green' })
  }
  shapes.push({ orig: to, customSvg: { html: badge(move.kind) } })
  return shapes
}

// Nước tiếp theo (sau nước đang xem, hết thì vòng về đầu) của bên `color` thuộc loại `kind`, để bấm vào số đếm là nhảy
// tới từng nước đó.
export function nextOfKind(review: GameReview, kind: MoveClass, color: 'w' | 'b', shown: number): number | null {
  const list = review.moves.filter((m) => m.kind === kind && m.color === color).map((m) => m.ply)
  if (list.length === 0) return null
  return list.find((ply) => ply > shown) ?? list[0]
}
