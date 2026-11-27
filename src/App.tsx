import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Color, PieceSymbol, Square } from 'chess.js'
import type { Config } from '@lichess-org/chessground/config'
import type { Key } from '@lichess-org/chessground/types'
import { ActionButton } from './components/ActionButton'
import { Board } from './components/Board'
import { BoardTools } from './components/BoardTools'
import { EndFx } from './components/EndFx'
import { endFxEvent, type EndFxEvent } from './components/endFxEvent'
import { MoveList, MoveStrip } from './components/MoveList'
import { PlayerBar, type ClockFace } from './components/PlayerBar'
import { PlayerNames } from './components/PlayerNames'
import { PromotionPicker } from './components/PromotionPicker'
import { ResultCard } from './components/ResultCard'
import { resultReason } from './components/resultReason'
import { TimeControlPicker } from './components/TimeControlPicker'
import { TopBar } from './components/TopBar'
import { describeGame, useFeedbackGame } from './feedback/context'
import { PageFoot } from './feedback/FeedbackForm'
import { controlLabel, flagTime, lastTimes, lowTime, newClock, recordMove, restoreClock, rewindClock, type ClockState } from './game/clock'
import {
  capturedPieces,
  describeMove,
  gameStatus,
  isPromotion,
  legalDests,
  materialDiff,
  replay,
  timeoutStatus,
  type GameStatus,
  type PlayedMove,
} from './game/rules'
import { END_DELAY, playMove, playSound } from './sound'
import { restoreNames, type Names } from './names'
import { loadSaved, save } from './storage'
import { moveMarks, reviewShapes } from './reviewView'
import { useGameReview } from './useGameReview'
import { useNow } from './useNow'
import { showBoard, useReview } from './useReview'
import { playReviewStep } from './reviewSound'

const COLOR_NAME: Record<Color, string> = { w: 'Trắng', b: 'Đen' }
const SIDE: Record<Color, 'white' | 'black'> = { w: 'white', b: 'black' }

function statusText(status: GameStatus, name: (color: Color) => string): string {
  if (status.kind !== 'playing') return ''
  return status.check ? `${name(status.turn)} đang bị chiếu!` : `Tới lượt ${name(status.turn)}`
}

export default function App() {
  const [moves, setMoves] = useState<PlayedMove[]>(() => {
    const saved = loadSaved<PlayedMove[]>('moves', [])
    try {
      replay(saved)
      return saved
    } catch {
      return []
    }
  })
  const [clock, setClock] = useState<ClockState>(() => restoreClock(loadSaved<unknown>('clock', null), moves.length, Date.now()))
  const [names, setNames] = useState<Names>(() => restoreNames(loadSaved<unknown>('names', null)))
  const [autoFlip, setAutoFlip] = useState<boolean>(() => loadSaved('autoFlip', false))
  const [orientation, setOrientation] = useState<'white' | 'black'>('white')
  // `ply`: nước phong cấp đi từ thế cờ sau nước thứ mấy (có thể là thế cờ đang xem lại).
  const [promotion, setPromotion] = useState<{ from: Square; to: Square; ply: number } | null>(null)
  const [confirmNew, setConfirmNew] = useState(false)

  const chess = useMemo(() => replay(moves), [moves])
  const sans = useMemo(() => chess.history(), [chess])
  const turn = chess.turn()
  const boardStatus = gameStatus(chess)
  // Lúc bên đang tới lượt hết giờ; null khi đồng hồ không chạy.
  const flagAt = boardStatus.kind === 'playing' ? flagTime(clock, turn) : null
  const now = useNow(flagAt)
  const status = flagAt !== null && now >= flagAt ? timeoutStatus(chess, turn) : boardStatus
  const over = status.kind !== 'playing'
  const picking = promotion !== null
  const boardSide = autoFlip ? SIDE[turn] : orientation
  const bottom: Color = boardSide === 'white' ? 'w' : 'b'
  const top: Color = bottom === 'w' ? 'b' : 'w'
  // Tên người chơi đã nhập; để trống thì gọi theo màu quân.
  const name = useCallback((color: Color) => names[color].trim() || COLOR_NAME[color], [names])

  // Xem lại thế cờ cũ: bàn cờ, quân đã ăn hiện theo thế cờ đang xem; tiến từng nước thì kêu tiếng nước đó.
  const stepSound = useCallback((to: number, from: number) => playReviewStep(moves, from, to), [moves])
  const review = useReview(moves.length, stepSound)
  const shownChess = useMemo(() => (review.reviewing ? replay(moves.slice(0, review.shown)) : chess), [review.reviewing, review.shown, moves, chess])
  const captured = capturedPieces(shownChess)
  // Dòng báo lượt: đang xem thế cờ cũ thì báo theo thế cờ đó, vì đi được ngay từ đó.
  const shownStatus = review.reviewing ? gameStatus(shownChess) : status
  const shownCheck = shownStatus.kind === 'playing' && shownStatus.check
  const material = materialDiff(shownChess)
  // Máy phân tích ván: chỉ mở khi ván đã xong.
  const analysis = useGameReview(over ? moves : null)
  const reviewed = analysis.state.status === 'done' ? analysis.state.review : null
  const marks = moveMarks(reviewed)

  useEffect(() => save('moves', moves), [moves])
  useEffect(() => save('clock', clock), [clock])
  useEffect(() => save('names', names), [names])
  useEffect(() => save('autoFlip', autoFlip), [autoFlip])

  // Tiếng hết ván: kêu đúng lúc ván vừa kết thúc, không kêu lại khi tải lại trang. Hết ván vì một nước đi
  // (chiếu bí, hòa) thì chờ tiếng quân đặt xuống xong; hết giờ thì kêu ngay.
  // Cùng lúc đó hiện hiệu ứng hết ván trên bàn cờ (chơi chung một máy: luôn là hiệu ứng mừng bên thắng).
  const lastKind = useRef(status.kind)
  const [endFx, setEndFx] = useState<EndFxEvent | null>(null)
  const winner = 'winner' in status ? status.winner : null
  useEffect(() => {
    if (lastKind.current === 'playing' && status.kind !== 'playing') {
      const decisive = status.kind === 'checkmate' || status.kind === 'timeout'
      const byClock = status.kind === 'timeout' || status.kind === 'timeoutDraw'
      playSound(decisive ? 'end' : 'draw', byClock ? 0 : END_DELAY)
      setEndFx(endFxEvent(decisive ? 'win' : 'draw', winner))
    }
    lastKind.current = status.kind
  }, [status.kind, winner])

  // Báo sắp hết giờ: kêu một lần khi đồng hồ đang chạy tụt xuống dưới mức đỏ. Được cộng giờ lên hẳn
  // (quá 1,5 lần mức đỏ), hoặc đi lại, ván mới, thì lần sau tụt xuống lại báo tiếp.
  const lowWarned = useRef<Record<Color, boolean>>({ w: false, b: false })
  useEffect(() => {
    if (!clock.control || flagAt === null || over) return
    const left = flagAt - now
    const limit = lowTime(clock.control)
    if (left > limit * 1.5) lowWarned.current[turn] = false
    else if (left < limit && left > 0 && !lowWarned.current[turn]) {
      lowWarned.current[turn] = true
      playSound('lowTime')
    }
  }, [now, flagAt, turn, clock.control, over])

  useEffect(() => {
    if (!confirmNew) return
    const timer = setTimeout(() => setConfirmNew(false), 3000)
    return () => clearTimeout(timer)
  }, [confirmNew])

  const config = useMemo<Config>(() => {
    // Đang chọn quân phong cấp: giữ nguyên bàn (tốt đứng ở ô cuối), khoá không cho đi.
    if (picking) return { orientation: boardSide, movable: { color: undefined, dests: new Map() } }
    // Ván đã xong thì chỉ xem. Đang xem lại thế cờ cũ thì đi tiếp được ngay từ thế cờ đó (bỏ các nước sau).
    const locked = over && !review.reviewing
    const last = shownChess.history({ verbose: true }).at(-1)
    return {
      fen: shownChess.fen(),
      orientation: boardSide,
      turnColor: SIDE[shownChess.turn()],
      check: shownChess.inCheck(),
      lastMove: last ? [last.from, last.to] : undefined,
      movable: {
        color: locked ? undefined : SIDE[shownChess.turn()],
        dests: locked ? new Map() : legalDests(shownChess),
      },
      drawable: { autoShapes: reviewShapes(reviewed, review.shown) },
    }
  }, [shownChess, boardSide, over, picking, review.reviewing, review.shown, reviewed])

  // Đồng hồ hiện trên thanh người chơi: bên đang tới lượt bị trừ dần theo giờ thật.
  function clockFace(color: Color): ClockFace | null {
    const last = lastTimes(clock)
    if (!clock.control || !last) return null
    const running = flagAt !== null && color === turn
    // Không bao giờ hiện nhiều hơn lúc bắt đầu lượt, kể cả khi `now` chưa kịp cập nhật.
    const ms = running ? Math.min(last[color], Math.max(0, flagAt - now)) : last[color]
    return { ms, running: running && !over, low: ms < lowTime(clock.control) }
  }

  // Giờ còn lại của hai bên lúc hết ván, cho bảng thống kê (ván không tính giờ thì không có).
  function endClocks(): Record<Color, number> | null {
    const white = clockFace('w')
    const black = clockFace('b')
    return white && black ? { w: white.ms, b: black.ms } : null
  }

  // Bàn cờ hiện thế cờ sau nước `ply` (bấm ở thẻ kết quả); điện thoại thì cuộn lên cho thấy bàn cờ.
  function goTo(ply: number) {
    review.go(ply)
    showBoard()
  }

  // Đi một nước từ thế cờ sau nước thứ `ply`: ghi nước đi, thời gian nghĩ và giờ của bên vừa đi.
  // `ply` nhỏ hơn số nước (đang xem lại thế cờ cũ) thì thay cho nút Đi lại: bỏ các nước sau, đồng hồ quay về
  // như lúc đó rồi mới ghi nước mới. Đi tiếp ở thế cờ hiện tại mà lỡ hết giờ rồi thì không nhận nước đó nữa.
  function play(move: PlayedMove, ply: number) {
    const time = Date.now()
    const rewind = ply < moves.length
    if (!rewind && flagAt !== null && time >= flagAt) return
    const from = rewind ? replay(moves.slice(0, ply)) : chess
    playMove(describeMove(from, move))
    setMoves((prev) => [...prev.slice(0, ply), move])
    review.reset()
    setClock((prev) => recordMove(rewind ? rewindClock(prev, ply, time) : prev, from.turn(), time))
  }

  function handleMove(from: Key, to: Key) {
    const move = { from: from as Square, to: to as Square }
    if (isPromotion(shownChess, move.from, move.to)) {
      setPromotion({ ...move, ply: review.shown })
      return
    }
    play(move, review.shown)
  }

  function pickPromotion(type: PieceSymbol) {
    if (!promotion) return
    const { ply, ...move } = promotion
    play({ ...move, promotion: type }, ply)
    setPromotion(null)
  }

  // Bỏ phong cấp: bàn cờ tự vẽ lại thế cờ cũ, tốt quay về chỗ.
  function cancelPromotion() {
    setPromotion(null)
  }

  // Dòng lớn ở bảng kết quả nổi trên bàn cờ.
  function endTitle(): string {
    if (!winner) return 'Hòa'
    return `${name(winner)} thắng!`
  }

  // Bấm Phân tích ở bảng kết quả trên bàn cờ: bật máy chấm, cuộn tới thẻ kết quả (điện thoại nằm dưới bàn cờ).
  function analyse() {
    analysis.start()
    requestAnimationFrame(() => document.querySelector('.result')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
  }

  function newGame() {
    if (moves.length > 0 && !over && !confirmNew) {
      setConfirmNew(true)
      return
    }
    setConfirmNew(false)
    setPromotion(null)
    setMoves([])
    setClock((prev) => newClock(prev.control))
    playSound('start')
  }

  const times = clock.spent

  // Ván đang chơi, để góp ý gửi kèm (người gặp lỗi khỏi phải tự kể).
  const feedbackState = describeGame(status, clock.control)
  const feedbackGame = useMemo(() => ({ sans, side: boardSide, state: feedbackState }), [sans, boardSide, feedbackState])
  useFeedbackGame(feedbackGame)

  return (
    <div className="app">
      <TopBar mode="local" />

      <main className="table">
        <section className="board-col">
          <PlayerBar
            color={top}
            name={names[top].trim()}
            rival={names[bottom].trim()}
            label={name(top)}
            captured={captured[top]}
            score={material[top].score}
            active={!over && turn === top}
            clock={clockFace(top)}
          />
          <div className={`board-frame${review.reviewing ? ' board-frame--review' : ''}`}>
            <Board config={config} onMove={handleMove} />
            {picking && <PromotionPicker color={shownChess.turn()} onPick={pickPromotion} onCancel={cancelPromotion} />}
            <EndFx
              event={endFx}
              end={over ? { winner } : undefined}
              chess={chess}
              orientation={boardSide}
              reviewing={review.reviewing}
              title={endTitle()}
              reason={resultReason(status, name)}
              onNew={newGame}
              onAnalyse={analysis.state.status === 'idle' ? analyse : undefined}
            />
          </div>
          <PlayerBar
            color={bottom}
            name={names[bottom].trim()}
            rival={names[top].trim()}
            label={name(bottom)}
            captured={captured[bottom]}
            score={material[bottom].score}
            active={!over && turn === bottom}
            clock={clockFace(bottom)}
          />
          <div className="board-under">
            <MoveStrip sans={sans} times={times} shown={review.shown} onGo={review.go} marks={marks} />
            <BoardTools
              autoFlip={autoFlip}
              onAutoFlip={() => setAutoFlip((on) => !on)}
              onFlip={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))}
              flipDisabled={autoFlip}
              flipTitle="Đang bật tự xoay bàn theo lượt"
            />
          </div>
        </section>

        <aside className="side">
          {over ? (
            <ResultCard
              result={status}
              name={name}
              chess={chess}
              sans={sans}
              times={times}
              clocks={endClocks()}
              orientation={boardSide}
              shown={review.shown}
              onGo={goTo}
              analysis={analysis}
            />
          ) : (
            <div
              className={`status${shownCheck ? ' status--check' : ''}${shownCheck || review.reviewing ? '' : ' status--plain'}`}
              role="status"
            >
              <span className="status__text">
                {/* Đang xem thế cờ cũ thì báo lượt của thế cờ đó: đi được ngay từ đó. */}
                {statusText(shownStatus, name)}
              </span>
              {clock.control && <span className="status__meta">{controlLabel(clock.control)}</span>}
              {review.reviewing && (
                <span className="status__hint">
                  Đi ở đây sẽ bỏ các nước sau.{' '}
                  <button type="button" className="link-button" onClick={() => review.go(moves.length)}>
                    Về ván đang chơi
                  </button>
                </span>
              )}
            </div>
          )}

          {moves.length === 0 && (
            <>
              <PlayerNames names={names} onChange={setNames} />
              <TimeControlPicker value={clock.control} onChange={(control) => setClock(newClock(control))} />
            </>
          )}

          {moves.length > 0 && <MoveList sans={sans} times={times} shown={review.shown} onGo={review.go} marks={marks} />}

          {/* Nút chỉ có hình, rê chuột vào mới hiện chữ. Hết ván thì Ván mới là nút chữ to cho dễ thấy. */}
          <div className="actions">
            {over ? (
              <button type="button" className="btn btn--primary actions__wide" onClick={newGame}>
                Ván mới
              </button>
            ) : (
              <ActionButton
                icon="newGame"
                label={confirmNew ? 'Bấm lần nữa để bắt đầu ván mới' : 'Ván mới'}
                danger={confirmNew}
                showTip={confirmNew}
                onClick={newGame}
              />
            )}
          </div>
        </aside>
      </main>
      <PageFoot />
    </div>
  )
}
