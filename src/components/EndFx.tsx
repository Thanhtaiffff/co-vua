// Hiệu ứng hết ván, hiện đè giữa bàn cờ trong chốc lát rồi tự tắt (không chặn bấm vào bàn cờ):
// - thắng: huy hiệu vua của bên thắng đội vương miện, pháo giấy bay ra (chỉ người thắng thấy pháo giấy)
// - thua (chơi online): vua của mình đổ nghiêng, bàn cờ tối đi một chút
// - hòa: huy hiệu ½
// Người bật "giảm chuyển động" trong máy thì chỉ hiện huy hiệu, không có pháo giấy và chuyển động.
// Màu lấy từ kiểu giao diện đang dùng (--accent, --led, --primary...).
import { useEffect, useState, type CSSProperties } from 'react'
import type { EndFxEvent } from './endFxEvent'
import './EndFx.css'


const SHOW_MS = 3200
const PIECES = 28

// Vị trí, góc bay, màu của từng mảnh pháo giấy: tính sẵn một lần, nhìn ngẫu nhiên nhưng không đổi giữa các lần vẽ.
const CONFETTI = Array.from({ length: PIECES }, (_, i) => {
  const angle = (i / PIECES) * Math.PI * 2 + ((i * 37) % 11) / 20
  const dist = 30 + ((i * 53) % 16) // phần trăm cạnh bàn cờ
  return {
    x: Math.round(Math.cos(angle) * dist),
    y: Math.round(Math.sin(angle) * dist * 0.9 - 10),
    r: (i * 97) % 360,
    tone: i % 4,
    delay: (i % 5) * 30,
  }
})

export function EndFx({ event }: { event: EndFxEvent | null }) {
  // Hiện xong thì nhớ số thứ tự để tắt; lần hết ván sau có số mới nên hiện lại.
  const [doneId, setDoneId] = useState(0)

  useEffect(() => {
    if (!event) return
    const timer = setTimeout(() => setDoneId(event.id), SHOW_MS)
    return () => clearTimeout(timer)
  }, [event])

  const shown = event && event.id !== doneId ? event : null
  if (!shown) return null
  const { kind, color } = shown
  return (
    <div key={shown.id} className={`endfx endfx--${kind}`} aria-hidden="true">
      {kind === 'win' && (
        <div className="endfx__confetti">
          {CONFETTI.map((bit, i) => (
            <i
              key={i}
              className={`endfx__bit endfx__bit--${bit.tone}`}
              style={{ '--x': bit.x, '--y': bit.y, '--r': `${bit.r}deg`, '--d': `${bit.delay}ms` } as CSSProperties}
            />
          ))}
        </div>
      )}
      <div className="endfx__medal">
        {kind === 'draw' ? (
          <span className="endfx__half">½</span>
        ) : (
          <>
            {kind === 'win' && (
              <svg className="endfx__crown" viewBox="0 0 48 30">
                <path d="M4 26 2 6l12 9 10-13 10 13 12-9-2 20z" />
              </svg>
            )}
            <span className={`endfx__kingbox endfx__kingbox--${color ?? 'w'}`}>
              <span className="endfx__king fig--k" />
            </span>
          </>
        )}
      </div>
    </div>
  )
}
