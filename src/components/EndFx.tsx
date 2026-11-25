// Hiệu ứng hết ván, vẽ đè lên bàn cờ. Có ba kiểu (endStyle.ts):
// - medal: huy hiệu giữa bàn cờ trong chốc lát rồi tự tắt (thắng: vương miện + pháo giấy; thua: vua đổ; hòa: ½).
// - king: vua bên thua đổ nghiêng ngay trên ô của nó (đổ đúng quân đang dùng, 2D hay 3D đều được), vua bên thắng đội
//   vương miện nhỏ, hòa thì hai vua có dấu ½. Giữ nguyên tới khi xem lại nước cũ, đi lại hay ván mới.
// - card: như king, thêm bảng kết quả nhỏ nổi giữa bàn (ai thắng, vì sao, Ván mới, Phân tích). Bấm ra ngoài là đóng.
// Pháo giấy chỉ có khi mình thắng (hay chơi chung một máy). Máy bật "giảm chuyển động" thì không bay nhảy, vua nằm sẵn.
// Màu lấy từ kiểu giao diện đang dùng (--accent, --led, --crown...).
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { Chess, Color, Square } from 'chess.js'
import type { EndFxEvent } from './endFxEvent'
import { useEndStyle } from './endStyle'
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

const other = (color: Color): Color => (color === 'w' ? 'b' : 'w')

// Cột, hàng (0..7, tính từ góc trên bên trái) của ô trên bàn cờ đang quay về phía `orientation`.
function cell(square: Square, orientation: 'white' | 'black'): { col: number; row: number } {
  const file = square.charCodeAt(0) - 97
  const rank = Number(square[1]) - 1
  return orientation === 'white' ? { col: file, row: 7 - rank } : { col: 7 - file, row: rank }
}

function kingSquare(chess: Chess, color: Color): Square | null {
  for (const row of chess.board()) for (const piece of row) if (piece?.type === 'k' && piece.color === color) return piece.square
  return null
}

const ICON_ANALYSE = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 20h18M5 16l4-5 4 3 6-8" />
    <circle cx="19" cy="6" r="1.2" fill="currentColor" />
  </svg>
)

const ICON_CLOSE = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
)

const CROWN = (
  <svg viewBox="0 0 48 30" aria-hidden="true">
    <path d="M4 26 2 6l12 9 10-13 10 13 12-9-2 20z" />
  </svg>
)

type Props = {
  event: EndFxEvent | null // lúc ván vừa xong (để chạy hiệu ứng một lần)
  // Ván đã xong: ai thắng (null là hòa). undefined khi ván đang chơi hay bị huỷ.
  end?: { winner: Color | null }
  chess?: Chess // thế cờ cuối, để tìm chỗ hai vua
  orientation?: 'white' | 'black'
  reviewing?: boolean // đang xem lại nước cũ: cất vua đổ, dấu, bảng đi
  title?: string // dòng lớn ở bảng kết quả: "Bạn thắng!", "Trắng thắng"...
  reason?: string // vì sao: "Chiếu bí", "Minh hết giờ"...
  onNew?: () => void // nút chính của bảng kết quả (chơi online: mời đấu ván nữa)
  newLabel?: string
  onAnalyse?: () => void // không có thì bảng không có nút Phân tích
}

export function EndFx({ event, end, chess, orientation = 'white', reviewing = false, title, reason, onNew, newLabel = 'Ván mới', onAnalyse }: Props) {
  const style = useEndStyle()
  // Hiện xong thì nhớ số thứ tự để tắt; lần hết ván sau có số mới nên hiện lại.
  const [doneId, setDoneId] = useState(0)
  const [closedId, setClosedId] = useState(0)
  const anchor = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!event) return
    const timer = setTimeout(() => setDoneId(event.id), SHOW_MS)
    return () => clearTimeout(timer)
  }, [event])

  // Xem lại nước cũ thì bảng kết quả coi như đã đóng, về lại không bật lên nữa.
  if (reviewing && event && closedId !== event.id) setClosedId(event.id)

  const fresh = event && event.id !== doneId ? event : null
  const onBoard = style !== 'medal' && end && chess && !reviewing ? end : null
  const winner = onBoard?.winner ?? null
  const fallen = onBoard && winner ? other(winner) : null
  const animate = fresh !== null

  // Vua đổ: xoay đúng quân vua trên bàn cờ quanh chân của nó. Bàn cờ đặt quân bằng transform: translate(x, y), nên
  // tâm xoay phải cộng thêm đúng (x, y) đó; cỡ ô đo lại mỗi khi bàn đổi cỡ.
  const fallSquare = fallen && chess ? kingSquare(chess, fallen) : null
  useEffect(() => {
    const board = anchor.current?.parentElement?.querySelector('cg-board')
    if (!(board instanceof HTMLElement) || !fallen || !fallSquare) return
    const { col, row } = cell(fallSquare, orientation)
    const place = () => {
      const size = board.clientWidth / 8
      board.style.setProperty('--fall-x', `${col * size}px`)
      board.style.setProperty('--fall-y', `${row * size}px`)
      board.style.setProperty('--sq', `${size}px`)
    }
    place()
    board.dataset.fall = fallen
    // Đổ về phía có chỗ trống hơn: vua ở nửa phải thì đổ sang trái và ngược lại.
    board.dataset.fallSide = col >= 4 ? 'left' : 'right'
    if (animate) board.dataset.fallAnim = ''
    const resize = new ResizeObserver(place)
    resize.observe(board)
    return () => {
      resize.disconnect()
      delete board.dataset.fall
      delete board.dataset.fallSide
      delete board.dataset.fallAnim
    }
  }, [fallen, fallSquare, orientation, animate])

  const marks: { square: Square; kind: 'crown' | 'half' }[] = []
  if (onBoard && chess) {
    if (winner) {
      const square = kingSquare(chess, winner)
      if (square) marks.push({ square, kind: 'crown' })
    } else {
      for (const color of ['w', 'b'] as const) {
        const square = kingSquare(chess, color)
        if (square) marks.push({ square, kind: 'half' })
      }
    }
  }

  // Pháo giấy bắn ra từ ô vua bên thắng (kiểu medal: từ giữa bàn).
  const confettiAt = (() => {
    if (style === 'medal' || !chess || !fresh || fresh.kind !== 'win' || !fresh.color) return null
    const square = kingSquare(chess, fresh.color)
    return square ? cell(square, orientation) : null
  })()

  const cardOpen = style === 'card' && event && event.id !== closedId && onBoard && !reviewing
  const close = () => event && setClosedId(event.id)

  useEffect(() => {
    if (!cardOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (style === 'medal') return <div ref={anchor} className="endfx-anchor">{fresh && <Medal event={fresh} />}</div>

  const kind = fresh?.kind ?? null
  return (
    <div ref={anchor} className="endfx-anchor">
      {(marks.length > 0 || fresh || cardOpen) && (
        <div
          className={`endfx endfx--board${animate ? ' endfx--fresh' : ''}${kind ? ` endfx--${kind}` : ''}${cardOpen ? ' endfx--open' : ''}`}
          onClick={cardOpen ? close : undefined}
          aria-hidden={cardOpen ? undefined : true}
        >
          {marks.map(({ square, kind: mark }) => {
            const { col, row } = cell(square, orientation)
            return (
              <span key={square} className={`endfx__mark endfx__mark--${mark}`} style={{ '--c': col, '--r': row } as CSSProperties}>
                <span className="endfx__tag">{mark === 'crown' ? CROWN : '½'}</span>
              </span>
            )
          })}
          {confettiAt && (
            <div className="endfx__confetti" style={{ '--ox': `${(confettiAt.col + 0.5) * 12.5}%`, '--oy': `${(confettiAt.row + 0.5) * 12.5}%` } as CSSProperties}>
              {CONFETTI.map((bit, i) => (
                <i
                  key={i}
                  className={`endfx__bit endfx__bit--${bit.tone}`}
                  style={{ '--x': bit.x, '--y': bit.y, '--r': `${bit.r}deg`, '--d': `${bit.delay}ms` } as CSSProperties}
                />
              ))}
            </div>
          )}
          {cardOpen && (
            <div
              className={`endcard endcard--${event.kind}`}
              role="dialog"
              aria-label={title}
              onClick={(e) => e.stopPropagation()}
            >
              <button type="button" className="endcard__close" onClick={close} aria-label="Đóng" title="Đóng">
                {ICON_CLOSE}
              </button>
              <p className="endcard__title">{title}</p>
              {reason && <p className="endcard__reason">{reason}</p>}
              <div className="endcard__actions">
                {onNew && (
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={() => {
                      close()
                      onNew()
                    }}
                  >
                    {newLabel}
                  </button>
                )}
                {onAnalyse && (
                  <button
                    type="button"
                    className="btn endcard__icon"
                    onClick={() => {
                      close()
                      onAnalyse()
                    }}
                    aria-label="Phân tích ván"
                    title="Phân tích ván"
                  >
                    {ICON_ANALYSE}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Kiểu medal (như bản cũ): huy hiệu giữa bàn cờ trong 3 giây.
function Medal({ event }: { event: EndFxEvent }) {
  const { kind, color } = event
  return (
    <div key={event.id} className={`endfx endfx--medal endfx--${kind}`} aria-hidden="true">
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
            {kind === 'win' && <span className="endfx__crown">{CROWN}</span>}
            <span className={`endfx__kingbox endfx__kingbox--${color ?? 'w'}`}>
              <span className="endfx__king fig--k" />
            </span>
          </>
        )}
      </div>
    </div>
  )
}
