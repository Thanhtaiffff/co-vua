// Sự kiện hết ván cho hiệu ứng EndFx (để riêng file vì không phải component).
import type { Color } from 'chess.js'

export type EndFxKind = 'win' | 'lose' | 'draw'
export type EndFxEvent = { id: number; kind: EndFxKind; color: Color | null } // color: vua của bên thắng (hay của mình khi thua)

// Thứ tự cho mỗi lần hết ván, để hiệu ứng chạy lại cả khi hai ván liền nhau cùng kết quả.
let counter = 0
export function endFxEvent(kind: EndFxKind, color: Color | null): EndFxEvent {
  counter += 1
  return { id: counter, kind, color }
}
