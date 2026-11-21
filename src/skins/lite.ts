// Chế độ nhẹ cho điện thoại (Tài chọn 2026-11-21). Kính mờ bắt card đồ họa vẽ lại phần nền sau mỗi tấm kính mỗi khi
// quân chạy, điện thoại yếu không theo kịp nên giật. Đo trên máy giả lập điện thoại, lượng việc vẽ khi đi quân:
//   đầy đủ 100%  ·  "lite" ~30%  ·  "max" ~13%.
// - Máy tính (chuột): giữ đầy đủ, có cả mép kính bẻ cong.
// - Điện thoại, máy tính bảng (màn cảm ứng): "lite" = bỏ mép bẻ cong và bỏ làm mờ tấm kính sau bàn cờ. Nhìn như cũ,
//   vì bàn cờ đã che gần hết tấm kính đó.
// - Điện thoại mà vẫn rớt nhiều khung hình khi chơi: tự chuyển sang "max" = kính giả (tấm đục hơn, không làm mờ), và
//   nhớ luôn cho các lần sau.
import { loadSaved, save } from '../storage'

export type LiteLevel = 'full' | 'lite' | 'max'

const SAVED = 'lite-max'
// Mỗi lần chạm màn hình, đo khung hình trong một khoảng ngắn sau đó (lúc quân đang chạy, bảng nước đi cập nhật).
const WINDOW_MS = 900
// Đủ ngần này lần chạm mới phán, để một lần giật lẻ (tải ảnh, máy bận việc khác) không làm đổi giao diện.
const MIN_TOUCHES = 8
const MAX_TOUCHES = 30
// Rớt quá ngần này phần khung hình thì coi là máy chậm. Máy giả lập chạy khoảng 40 khung/giây (thấy rõ là giật) đo ra
// 15%, máy chạy mượt đo ra 0%.
const SLOW_SHARE = 0.12

// Phán từ khoảng cách giữa các khung hình (ms). Nhịp màn hình lấy từ những khung nhanh nhất, nhưng không tính nhanh hơn
// 60 Hz: màn 120 Hz (như S23) tự hạ xuống 60 Hz lúc ít chuyển động, không phải giật. Khung nào dài hơn 1,6 nhịp (với màn
// 60 Hz là khoảng 27 ms, tức dưới 37 khung/giây) thì tính là rớt.
export function droppedShare(gaps: readonly number[]): number {
  if (gaps.length < 20) return 0
  const sorted = [...gaps].sort((a, b) => a - b)
  const beat = Math.max(16, sorted[Math.floor(sorted.length * 0.1)])
  return gaps.filter((gap) => gap > beat * 1.6).length / gaps.length
}

export function isSlow(gaps: readonly number[], touches: number): boolean {
  return touches >= MIN_TOUCHES && droppedShare(gaps) > SLOW_SHARE
}

function apply(level: LiteLevel): void {
  const root = document.documentElement
  root.classList.toggle('lite', level !== 'full')
  root.classList.toggle('lite-max', level === 'max')
}

// Gắn lớp lite / lite-max lên <html> và trả về mức lúc mở trang (sau đó có thể tự lên "max").
export function liteMode(): LiteLevel {
  const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
  if (!touch) {
    apply('full')
    return 'full'
  }
  if (loadSaved<boolean>(SAVED, false)) {
    apply('max')
    return 'max'
  }
  apply('lite')
  watchFrames(() => {
    save(SAVED, true)
    apply('max')
  })
  return 'lite'
}

function watchFrames(slow: () => void): void {
  const gaps: number[] = []
  let touches = 0
  let until = 0
  let running = false

  const frame = (time: number, last: number) => {
    if (document.visibilityState === 'visible') gaps.push(time - last)
    if (time < until) {
      requestAnimationFrame((next) => frame(next, time))
      return
    }
    running = false
    // Ghi lại số đo để xem được khi kiểm tra (công cụ của trình duyệt, bản chơi thử)
    document.documentElement.dataset.liteDrop = `${Math.round(droppedShare(gaps) * 100)}% / ${touches}`
    if (isSlow(gaps, touches)) {
      stop()
      slow()
    } else if (touches >= MAX_TOUCHES) stop()
  }

  const onTouch = () => {
    touches++
    until = performance.now() + WINDOW_MS
    if (running) return
    running = true
    requestAnimationFrame((first) => requestAnimationFrame((time) => frame(time, first)))
  }
  const stop = () => document.removeEventListener('pointerup', onTouch, true)
  document.addEventListener('pointerup', onTouch, { capture: true, passive: true })
}
