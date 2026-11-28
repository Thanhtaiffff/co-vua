// Câu giải thích vì sao ván kết thúc, dùng ở thẻ kết quả và bảng kết quả nổi trên bàn cờ.
import type { Color } from 'chess.js'
import type { GameResult } from '../game/rules'

const other = (color: Color): Color => (color === 'w' ? 'b' : 'w')

export function resultReason(result: GameResult, name: (color: Color) => string): string {
  switch (result.kind) {
    case 'checkmate':
      return 'Chiếu bí'
    case 'timeout':
      return `${name(other(result.winner))} hết giờ`
    case 'resign':
      return `${name(other(result.winner))} đầu hàng`
    case 'abandon':
      return `${name(other(result.winner))} rời ván quá lâu`
    case 'timeoutDraw':
      return `${name(result.flagged)} hết giờ, nhưng ${name(other(result.flagged))} không còn đủ quân để chiếu bí`
    case 'agreed':
      return 'Hai bên đồng ý hòa'
    case 'stalemate':
      return 'Hết nước đi mà không bị chiếu (pat)'
    case 'insufficient':
      return 'Không còn đủ quân để chiếu bí'
    case 'threefold':
      return 'Lặp lại thế cờ 3 lần'
    case 'fifty':
      return '50 nước không ăn quân, không đi tốt'
    case 'aborted':
      return 'Chưa ai đi quá một nước nên không tính'
    case 'playing':
      return ''
  }
}
