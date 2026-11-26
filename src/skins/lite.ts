// Chế độ nhẹ cho điện thoại (Tài chọn 2026-11-21). Kính mờ bắt card đồ họa vẽ lại phần nền sau mỗi tấm kính mỗi khi
// quân chạy, điện thoại yếu không theo kịp nên giật. Đo trên máy giả lập điện thoại, lượng việc vẽ khi đi quân:
//   đầy đủ 100%  ·  "lite" ~30%  ·  "max" ~13%.
// - Máy tính (chuột): đầy đủ, có cả mép kính bẻ cong. Mép bẻ cong nặng tới mức cả máy gaming cũng hơi giật (đo
//   1920x1080: ~11 khung/giây khi đi quân, không kính ~60), nên máy tính cũng được đo như điện thoại ở dưới.
// - Điện thoại, máy tính bảng (màn cảm ứng): "lite" = bỏ mép bẻ cong và bỏ làm mờ tấm kính sau bàn cờ. Nhìn như cũ,
//   vì bàn cờ đã che gần hết tấm kính đó.
// - Máy nào vẫn rớt nhiều khung hình khi chơi: tự chuyển sang "max" = giao diện Nhẹ (kiểu Bê tông gốc, không kính,
//   xem be-tong.css), và nhớ luôn cho các lần sau.
import { useSyncExternalStore } from 'react'
import { loadSaved, save } from '../storage'
import { liquidGlass } from './liquidGlass'

export type LiteLevel = 'full' | 'lite' | 'max'

const SAVED = 'lite-max'
// Mỗi lần chạm màn hình (hoặc bấm chuột), đo khung hình trong một khoảng ngắn sau đó (lúc quân đang chạy, bảng nước đi cập nhật).
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
  // Mép kính bẻ cong chỉ có ở mức đầy đủ (và chỉ trên Chrome, Edge).
  liquidGlass(level === 'full')
}

// Người chơi chọn hiệu ứng trong bảng Chủ đề (Tài chọn 2026-11-26, vì cả máy gaming vẫn hơi giật):
// - "auto" (mặc định): như trên, và máy tính cũng tự đo, giật thì tự sang Nhẹ.
// - "dep": luôn Bê tông kính đầy đủ, kể cả trên điện thoại.
// - "nhe": luôn Bê tông gốc ("max").
export type FxChoice = 'auto' | 'dep' | 'nhe'
const CHOICE = 'hieu-ung'
const CHOICES: readonly FxChoice[] = ['auto', 'dep', 'nhe']

export function readChoice(raw: unknown): FxChoice {
  return CHOICES.includes(raw as FxChoice) ? (raw as FxChoice) : 'auto'
}

export type Fx = { choice: FxChoice; level: LiteLevel }
let fx: Fx = { choice: 'auto', level: 'full' }
let stopWatch: (() => void) | null = null
const listeners = new Set<() => void>()

function settle(level: LiteLevel): void {
  apply(level)
  fx = { choice: fx.choice, level }
  for (const listener of listeners) listener()
}

// Mức nào được dùng khi chọn `choice`, trên máy cảm ứng (`touch`) hay không, máy đã từng bị phán chậm (`wasSlow`) hay chưa.
export function levelFor(choice: FxChoice, touch: boolean, wasSlow: boolean): LiteLevel {
  if (choice === 'dep') return 'full'
  if (choice === 'nhe' || wasSlow) return 'max'
  return touch ? 'lite' : 'full'
}

function resolve(): void {
  stopWatch?.()
  stopWatch = null
  const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
  const level = levelFor(fx.choice, touch, loadSaved<boolean>(SAVED, false))
  settle(level)
  if (fx.choice === 'auto' && level !== 'max') {
    stopWatch = watchFrames(() => {
      stopWatch = null
      save(SAVED, true)
      settle('max')
    })
  }
}

// Gắn lớp lite / lite-max lên <html> lúc mở trang theo lựa chọn đã lưu.
export function liteMode(): void {
  fx = { choice: readChoice(loadSaved<unknown>(CHOICE, 'auto')), level: 'full' }
  resolve()
}

export function setFx(choice: FxChoice): void {
  save(CHOICE, choice)
  // Chọn lại "Tự động" thì đo lại từ đầu, để máy vừa bật card đồ họa mạnh hơn có cơ hội quay về đầy đủ.
  if (choice === 'auto') save(SAVED, false)
  fx = { choice, level: fx.level }
  resolve()
}

export function useFx(): Fx {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => fx,
  )
}

// Theo dõi khung hình sau mỗi lần chạm hoặc bấm chuột; máy chậm thì gọi `slow`. Trả về hàm thôi theo dõi.
function watchFrames(slow: () => void): () => void {
  const gaps: number[] = []
  let touches = 0
  let until = 0
  let running = false
  let stopped = false

  const frame = (time: number, last: number) => {
    if (stopped) return
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
  const stop = () => {
    stopped = true
    document.removeEventListener('pointerup', onTouch, true)
  }
  document.addEventListener('pointerup', onTouch, { capture: true, passive: true })
  return stop
}
