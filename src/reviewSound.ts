// Tiếng khi xem lại các nước đã đi (nút mũi tên, phím ← →, bấm một nước trong danh sách, biểu đồ phân tích).
import { describeMove, replay, type PlayedMove } from './game/rules'
import { moveSounds, playReview, undoSounds, type Sample } from './sound'

// Bàn cờ đổi từ thế cờ sau nước `from` sang thế cờ sau nước `to` thì kêu những tiếng nào:
// - lùi đúng một nước: tiếng quân của nước vừa gỡ (gỡ nước ăn quân thì nghe tiếng ăn quân);
// - tiến hay nhảy tới một nước: tiếng đầy đủ của nước đó, như lúc đi thật (có cả báo chiếu, phong cấp);
// - về đầu ván: một tiếng đi quân.
export function reviewSounds(moves: PlayedMove[], from: number, to: number): Sample {
  if (to === from || to < 0 || to > moves.length) return []
  if (to === from - 1) return undoSounds(describeMove(replay(moves.slice(0, to)), moves[to]))
  if (to === 0) return [['move', 0]]
  return moveSounds(describeMove(replay(moves.slice(0, to - 1)), moves[to - 1]))
}

export function playReviewStep(moves: PlayedMove[], from: number, to: number): void {
  playReview(reviewSounds(moves, from, to))
}
