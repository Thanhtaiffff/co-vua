// Kính lỏng kiểu iOS: mép mỗi tấm kính bẻ cong hình phía sau như thấu kính.
// Trình duyệt chỉ làm được việc này bằng bộ lọc SVG đặt trong backdrop-filter, mà hiện chỉ nhân Chromium (Chrome, Edge,
// Cốc Cốc, Samsung Internet) hỗ trợ. Safari, Firefox và mọi trình duyệt trên iPhone không chạy phần này, vẫn thấy kính mờ
// thường (phần CSS trong glass.css).
// Bộ lọc phải biết đúng cỡ tấm kính (tính bằng điểm ảnh), nên mỗi cỡ có một bộ lọc riêng, tạo khi cần, rồi gắn vào tấm
// kính qua biến --lens. Tấm kính đổi cỡ (xoay máy, kéo cửa sổ) thì đổi bộ lọc theo.

// Các tấm kính lớn được bẻ mép. Nút nhỏ thì chỉ mờ, bẻ mép trên vật 40px không thấy gì mà tốn máy.
const LENS = '.card, .tc, .moves, .result, .scorecard, .chat, .offer, .strip, .board-frame, .mode, .clock, .icon-btn, .act, .board-tool'
const NS = 'http://www.w3.org/2000/svg'

let defs: SVGSVGElement | null = null
let made = new Set<string>()
let seen = new WeakSet<Element>()
let watch: MutationObserver | null = null
let sizes: ResizeObserver | null = null

// navigator.userAgentData chỉ có trên trình duyệt nhân Chromium.
const chromium = () => typeof navigator !== 'undefined' && 'userAgentData' in navigator && typeof ResizeObserver !== 'undefined'

export function liquidGlass(on: boolean): void {
  if (!on || !chromium()) {
    stop()
    return
  }
  if (watch) return
  defs = document.createElementNS(NS, 'svg')
  defs.setAttribute('aria-hidden', 'true')
  defs.setAttribute('class', 'lens-defs')
  document.body.append(defs)
  sizes = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const box = entry.borderBoxSize?.[0]
      fit(entry.target as HTMLElement, box ? box.inlineSize : entry.contentRect.width, box ? box.blockSize : entry.contentRect.height)
    }
  })
  const scan = () => {
    for (const el of document.querySelectorAll<HTMLElement>(LENS)) {
      if (seen.has(el)) continue
      seen.add(el)
      sizes?.observe(el, { box: 'border-box' })
    }
  }
  watch = new MutationObserver(scan)
  watch.observe(document.body, { childList: true, subtree: true })
  scan()
}

function stop(): void {
  watch?.disconnect()
  sizes?.disconnect()
  watch = null
  sizes = null
  defs?.remove()
  defs = null
  made = new Set()
  seen = new WeakSet()
  for (const el of document.querySelectorAll<HTMLElement>(LENS)) el.style.removeProperty('--lens')
}

function fit(el: HTMLElement, width: number, height: number): void {
  const w = Math.round(width)
  const h = Math.round(height)
  if (w < 12 || h < 12 || !defs) return
  const key = `${w}x${h}`
  if (!made.has(key)) {
    made.add(key)
    defs.append(lensFilter(key, w, h))
  }
  el.style.setProperty('--lens', `url(#lens-${key})`)
}

// Bộ lọc: ảnh lệch (kênh đỏ lệch ngang, kênh xanh lá lệch dọc), trung tính ở giữa, mạnh dần sát mép.
function lensFilter(key: string, w: number, h: number): SVGFilterElement {
  const band = Math.max(6, Math.min(34, Math.round(Math.min(w, h) * 0.4))) // bề rộng dải mép bị bẻ
  const filter = document.createElementNS(NS, 'filter')
  set(filter, { id: `lens-${key}`, filterUnits: 'userSpaceOnUse', x: 0, y: 0, width: w, height: h, 'color-interpolation-filters': 'sRGB' })
  const mapX = document.createElementNS(NS, 'feImage')
  set(mapX, { href: ramp('x', w, h, band), x: 0, y: 0, width: w, height: h, preserveAspectRatio: 'none', result: 'mx' })
  const mapY = document.createElementNS(NS, 'feImage')
  set(mapY, { href: ramp('y', w, h, band), x: 0, y: 0, width: w, height: h, preserveAspectRatio: 'none', result: 'my' })
  const join = document.createElementNS(NS, 'feComposite')
  set(join, { in: 'mx', in2: 'my', operator: 'arithmetic', k2: 1, k3: 1, result: 'map' })
  const bend = document.createElementNS(NS, 'feDisplacementMap')
  set(bend, { in: 'SourceGraphic', in2: 'map', scale: -Math.round(band * 1.7), xChannelSelector: 'R', yChannelSelector: 'G' })
  filter.append(mapX, mapY, join, bend)
  return filter
}

function ramp(axis: 'x' | 'y', w: number, h: number, band: number): string {
  const length = axis === 'x' ? w : h
  const steps = 8
  const near: string[] = []
  const far: string[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const push = (1 - t) ** 2.2 // 1 sát mép, 0 khi vào hết dải
    const at = ((t * band) / length).toFixed(4)
    const back = (1 - (t * band) / length).toFixed(4)
    near.push(`<stop offset="${at}" stop-color="${color(axis, 128 + 127 * push)}"/>`)
    far.unshift(`<stop offset="${back}" stop-color="${color(axis, 128 - 128 * push)}"/>`)
  }
  const svg =
    `<svg xmlns="${NS}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">` +
    `<linearGradient id="g" x2="${axis === 'x' ? 1 : 0}" y2="${axis === 'y' ? 1 : 0}">${near.join('')}${far.join('')}</linearGradient>` +
    `<rect width="${w}" height="${h}" fill="url(#g)"/></svg>`
  return `data:image/svg+xml;base64,${btoa(svg)}`
}

function color(axis: 'x' | 'y', value: number): string {
  const v = Math.round(value)
  return axis === 'x' ? `rgb(${v},0,0)` : `rgb(0,${v},0)`
}

function set(el: Element, attrs: Record<string, string | number>): void {
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, String(value))
}
