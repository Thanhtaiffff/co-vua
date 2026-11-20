// Ký hiệu loại nước máy chấm (★ ! ✓ ?! ? ??) trong vòng tròn màu; rê chuột vào hiện tên loại.
import type { MoveClass } from '../game/review'
import { CLASS_META } from '../reviewView'
import './review.css'

export function Glyph({ kind }: { kind: MoveClass }) {
  const meta = CLASS_META[kind]
  return (
    <span className={`glyph${meta.glyph.length > 1 ? ' glyph--wide' : ''}`} style={{ background: meta.color }} aria-label={meta.label} title={meta.label}>
      {meta.glyph}
    </span>
  )
}
