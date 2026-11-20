// Phần "Phân tích ván" trong thẻ kết quả: lúc máy đang xem thì có thanh tiến độ; xem xong thì có lời nhận xét nước đang
// xem, biểu đồ thế trận cả ván (bấm vào là nhảy tới nước đó), độ chính xác và số nước mỗi loại của hai bên (bấm số là
// nhảy lần lượt tới từng nước loại đó).
import { useRef, type PointerEvent } from 'react'
import type { Color } from 'chess.js'
import { formatScore, MOVE_CLASSES, type GameReview, type MoveClass } from '../game/review'
import { moveLabel } from '../game/stats'
import { CLASS_META, FLAGGED, nextOfKind } from '../reviewView'
import { Glyph } from './Glyph'
import type { GameReviewApi } from '../useGameReview'
import './review.css'

type Props = {
  api: GameReviewApi
  sans: string[]
  name: (color: Color) => string
  shown: number
  onGo: (ply: number) => void
}

// Biểu đồ thế trận: phần trắng là khả năng thắng của Trắng, phần tối của Đen; đường giữa là cân bằng.
function EvalGraph({ review, shown, onGo }: { review: GameReview; shown: number; onGo: (ply: number) => void }) {
  const box = useRef<SVGSVGElement>(null)
  const n = review.win.length - 1
  const W = 200
  const x = (ply: number) => (n === 0 ? 0 : (ply / n) * W)
  const y = (win: number) => 100 - win
  const line = review.win.map((w, i) => `${x(i).toFixed(2)},${y(w).toFixed(2)}`).join(' ')

  function pick(event: PointerEvent<SVGSVGElement>) {
    const rect = box.current?.getBoundingClientRect()
    if (!rect || n === 0) return
    onGo(Math.round(((event.clientX - rect.left) / rect.width) * n))
  }

  return (
    <svg
      ref={box}
      className="review__graph"
      viewBox={`0 0 ${W} 100`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Biểu đồ thế trận cả ván"
      onPointerDown={pick}
      onPointerMove={(e) => e.buttons === 1 && pick(e)}
    >
      <rect width={W} height="100" className="review__graph-black" />
      <polygon points={`0,100 ${line} ${W},100`} className="review__graph-white" />
      <line x1="0" x2={W} y1="50" y2="50" className="review__graph-mid" />
      <line x1={x(shown)} x2={x(shown)} y1="0" y2="100" className="review__graph-now" />
      {review.moves
        .filter((m) => FLAGGED.includes(m.kind))
        .map((m) => (
          <circle key={m.ply} cx={x(m.ply)} cy={y(review.win[m.ply])} r="3.2" fill={CLASS_META[m.kind].color} className="review__graph-dot" />
        ))}
    </svg>
  )
}

// Một dòng nhận xét nước đang xem, vd "★ 12. Nf3 Tốt nhất" hay "?? 12. Nf3 Hớ nặng · Hay hơn: Qxd5".
function Note({ review, sans, shown }: { review: GameReview; sans: string[]; shown: number }) {
  const score = <span className="review__score">{formatScore(review.scores[shown])}</span>
  const move = review.moves[shown - 1]
  if (!move) return <p className="review__note review__note--start">Đầu ván {score}</p>
  return (
    <p className="review__note">
      <Glyph kind={move.kind} />
      <span className="review__move">{moveLabel(move.ply, sans[move.ply - 1])}</span>
      <span style={{ color: CLASS_META[move.kind].color }} className="review__kind">
        {CLASS_META[move.kind].label}
      </span>
      {score}
      {move.kind !== 'best' && move.bestSan && <span className="review__best">Hay hơn: {move.bestSan}</span>}
    </p>
  )
}

const ICON_STOP = <path d="M6 6l12 12M18 6L6 18" />

export function GameReviewPanel({ api, sans, name, shown, onGo }: Props) {
  const { state } = api
  if (state.status === 'idle') return null

  if (state.status === 'running') {
    const percent = Math.round((state.done / state.total) * 100)
    return (
      <div className="review review--running" role="status">
        <div className="review__progress" style={{ ['--p' as string]: `${percent}%` }} />
        <span className="review__progress-text">Máy đang xem… {percent}%</span>
        <button type="button" className="icon-btn review__stop" aria-label="Dừng phân tích" title="Dừng phân tích" onClick={api.cancel}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
            {ICON_STOP}
          </svg>
        </button>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="review review--error" role="status">
        <span>Máy phân tích chưa chạy được trên trình duyệt này.</span>
        <button type="button" className="link-button" onClick={api.start}>
          Thử lại
        </button>
      </div>
    )
  }

  const { review } = state
  return (
    <div className="review">
      <Note review={review} sans={sans} shown={shown} />
      <EvalGraph review={review} shown={shown} onGo={onGo} />
      <table className="review__table">
        <thead>
          <tr>
            <th scope="col" className="review__who">
              {name('w')}
            </th>
            <th scope="col" className="review__mid" />
            <th scope="col" className="review__who review__who--b">
              {name('b')}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr className="review__accuracy">
            <td className="review__count review__count--w">{review.sides.w.accuracy.toFixed(1)}</td>
            <th scope="row">Độ chính xác</th>
            <td className="review__count review__count--b">{review.sides.b.accuracy.toFixed(1)}</td>
          </tr>
          {MOVE_CLASSES.map((kind) => (
            <tr key={kind}>
              <Count review={review} kind={kind} color="w" shown={shown} onGo={onGo} />
              <th scope="row">
                <span className="review__label">
                  <Glyph kind={kind} />
                  {CLASS_META[kind].label}
                </span>
              </th>
              <Count review={review} kind={kind} color="b" shown={shown} onGo={onGo} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Count({ review, kind, color, shown, onGo }: { review: GameReview; kind: MoveClass; color: Color; shown: number; onGo: (ply: number) => void }) {
  const count = review.sides[color].counts[kind]
  const next = nextOfKind(review, kind, color, shown)
  return (
    <td className={`review__count review__count--${color}`}>
      {count > 0 && next !== null ? (
        <button type="button" className="review__jump" style={{ color: CLASS_META[kind].color }} title={`Xem ${CLASS_META[kind].label.toLowerCase()} tiếp theo`} onClick={() => onGo(next)}>
          {count}
        </button>
      ) : (
        <span className="review__zero">0</span>
      )}
    </td>
  )
}
