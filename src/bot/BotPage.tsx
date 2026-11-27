// Trang chơi với máy (/may). Trước ván: chọn mức, màu quân, thời gian rồi bấm Chơi. Trong ván: máy tự đi khi tới lượt
// máy; người chơi được Đi lại (lùi nước mình và nước máy vừa đáp), Đầu hàng, Ván mới. Hết ván thì hiện thẻ kết quả như
// trang chơi một máy. Ván đang chơi lưu trong máy, tải lại trang không mất.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Color, PieceSymbol, Square } from 'chess.js'
import type { Config } from '@lichess-org/chessground/config'
import type { Key } from '@lichess-org/chessground/types'
import { Board } from '../components/Board'
import { BoardTools } from '../components/BoardTools'
import { MoveList, MoveStrip } from '../components/MoveList'
import { PlayerBar, type ClockFace } from '../components/PlayerBar'
import { PromotionPicker } from '../components/PromotionPicker'
import { EndFx } from '../components/EndFx'
import { endFxEvent, type EndFxEvent } from '../components/endFxEvent'
import { ResultCard } from '../components/ResultCard'
import { resultReason } from '../components/resultReason'
import { TopBar } from '../components/TopBar'
import { Engine } from '../engine/stockfish'
import { describeGame, useFeedbackGame } from '../feedback/context'
import { PageFoot } from '../feedback/FeedbackForm'
import { describeControl, flagTime, lastTimes, lowTime, newClock, recordMove, restoreClock, sameControl, TIME_CONTROLS, undoMove, type ClockState, type TimeControl } from '../game/clock'
import {
  capturedPieces,
  describeMove,
  gameStatus,
  isPromotion,
  legalDests,
  materialDiff,
  replay,
  timeoutStatus,
  winnerOf,
  type GameResult,
  type PlayedMove,
} from '../game/rules'
import { myName } from '../online/identity'
import { END_DELAY, playMove, playSound } from '../sound'
import { loadSaved, save } from '../storage'
import { useNow } from '../useNow'
import { showBoard, useReview } from '../useReview'
import { playReviewStep } from '../reviewSound'
import { moveMarks, reviewShapes } from '../reviewView'
import { useGameReview } from '../useGameReview'
import './bot.css'
import { BotSetup, type ColorChoice } from './BotSetup'
import { botMove, clampElo, DEFAULT_ELO, eloFromOldLevel, eloLabel, fromUci, isImpossible, naturalWait, tierName, toUci, type BotClock } from './levels'

const SIDE: Record<Color, 'white' | 'black'> = { w: 'white', b: 'black' }
const other = (color: Color): Color => (color === 'w' ? 'b' : 'w')

// Ván đang chơi: người chơi cầm màu nào, máy bao nhiêu Elo (chốt lúc bấm Chơi).
type Game = { side: Color; elo: number }


function savedGame(): Game | null {
  const saved = loadSaved<{ side?: unknown; elo?: unknown; level?: unknown } | null>('botGame', null)
  if (!saved || (saved.side !== 'w' && saved.side !== 'b')) return null
  // Ván lưu từ hồi còn 6 nút mức thì đổi mức sang Elo.
  const elo = typeof saved.elo === 'number' ? clampElo(saved.elo) : eloFromOldLevel(saved.level)
  return elo === null ? null : { side: saved.side, elo }
}

// Elo đã chọn lần trước; chưa có thì lấy theo mức cũ (nếu từng chọn), không thì mặc định.
function savedElo(): number {
  const saved = loadSaved<unknown>('botElo', null)
  if (typeof saved === 'number') return clampElo(saved)
  return eloFromOldLevel(loadSaved<unknown>('botLevel', null)) ?? DEFAULT_ELO
}

function savedControl(): TimeControl | null {
  const saved = loadSaved<unknown>('botControl', null)
  if (saved === null) return null
  return TIME_CONTROLS.flatMap((group) => group.controls).find((c) => sameControl(c, saved as TimeControl)) ?? null
}

export function BotPage() {
  const [game, setGame] = useState<Game | null>(savedGame)
  const [moves, setMoves] = useState<PlayedMove[]>(() => {
    if (!savedGame()) return []
    const saved = loadSaved<PlayedMove[]>('botMoves', [])
    try {
      replay(saved)
      return saved
    } catch {
      return []
    }
  })
  const [clock, setClock] = useState<ClockState>(() => restoreClock(loadSaved<unknown>('botClock', null), moves.length, Date.now()))
  const [resigned, setResigned] = useState<boolean>(() => loadSaved('botResigned', false))
  const [elo, setElo] = useState<number>(savedElo)
  const [colorChoice, setColorChoice] = useState<ColorChoice>(() => {
    const saved = loadSaved<unknown>('botColor', 'w')
    return saved === 'b' || saved === 'random' ? saved : 'w'
  })
  const [control, setControl] = useState<TimeControl | null>(savedControl)
  const [flipped, setFlipped] = useState(false)
  const [promotion, setPromotion] = useState<{ from: Square; to: Square } | null>(null)
  const [confirm, setConfirm] = useState<'new' | 'resign' | null>(null)
  const [thinking, setThinking] = useState(false)
  const [engineError, setEngineError] = useState(false)
  const [retry, setRetry] = useState(0)

  // Mỗi trang một máy riêng; rời trang thì tắt máy. Tải máy ngay để người chơi chọn xong là máy sẵn sàng.
  const engineRef = useRef<Engine | null>(null)
  useEffect(() => {
    const engine = new Engine()
    engineRef.current = engine
    engine.ready().catch(() => setEngineError(true))
    return () => {
      engine.dispose()
      if (engineRef.current === engine) engineRef.current = null
    }
  }, [retry])

  const chess = useMemo(() => replay(moves), [moves])
  const sans = useMemo(() => chess.history(), [chess])
  const turn = chess.turn()
  const you: Color = game?.side ?? (colorChoice === 'b' ? 'b' : 'w')
  const bot = other(you)
  const botElo = game?.elo ?? elo
  const boardStatus = useMemo(() => gameStatus(chess), [chess])
  const flagAt = game && boardStatus.kind === 'playing' ? flagTime(clock, turn) : null
  const now = useNow(flagAt)
  const status = flagAt !== null && now >= flagAt ? timeoutStatus(chess, turn) : boardStatus
  const result: GameResult = resigned ? { kind: 'resign', winner: bot } : status
  const over = game !== null && result.kind !== 'playing'
  const playing = game !== null && !over
  const picking = promotion !== null && playing
  const botTurn = playing && turn === bot
  const bottom: Color = flipped ? bot : you
  const top = other(bottom)
  const boardSide = SIDE[bottom]
  const yourName = myName().trim()
  const botName = isImpossible(botElo) ? 'Máy · Impossible' : `Máy · ${tierName(botElo)} ${eloLabel(botElo)}`
  const name = useCallback((color: Color) => (color === you ? yourName || 'Bạn' : botName), [you, yourName, botName])

  const stepSound = useCallback((to: number, from: number) => playReviewStep(moves, from, to), [moves])
  const review = useReview(moves.length, stepSound)
  const shownChess = useMemo(() => (review.reviewing ? replay(moves.slice(0, review.shown)) : chess), [review.reviewing, review.shown, moves, chess])
  // Chỉ tính lại khi thế cờ đổi, không phải mỗi lần đồng hồ nhảy số (10 lần mỗi giây).
  const captured = useMemo(() => capturedPieces(shownChess), [shownChess])
  const material = useMemo(() => materialDiff(shownChess), [shownChess])

  // Phân tích ván sau khi hết ván, như trang chơi một máy và chơi online (máy chấm riêng, không dùng máy đang đánh).
  const analysis = useGameReview(over ? moves : null)
  const reviewed = analysis.state.status === 'done' ? analysis.state.review : null
  const marks = moveMarks(reviewed)

  useEffect(() => save('botGame', game), [game])
  useEffect(() => save('botMoves', moves), [moves])
  useEffect(() => save('botClock', clock), [clock])
  useEffect(() => save('botResigned', resigned), [resigned])
  useEffect(() => save('botElo', elo), [elo])
  useEffect(() => save('botColor', colorChoice), [colorChoice])
  useEffect(() => save('botControl', control), [control])

  // Tiếng hết ván, như trang chơi một máy.
  const lastKind = useRef(result.kind)
  useEffect(() => {
    if (lastKind.current === 'playing' && result.kind !== 'playing' && game) {
      const decisive = result.kind === 'checkmate' || result.kind === 'timeout' || result.kind === 'resign'
      const byClock = result.kind === 'timeout' || result.kind === 'timeoutDraw' || result.kind === 'resign'
      playSound(decisive ? 'end' : 'draw', byClock ? 0 : END_DELAY)
    }
    lastKind.current = result.kind
  }, [result.kind, game])

  // Hiệu ứng hết ván, bật đúng lúc ván vừa xong (mở trang khi ván đã xong thì không bật): mình thắng thì mừng, thua thì
  // vua mình đổ. Tính ngay lúc vẽ khi thấy ván đổi trạng thái.
  const winner = winnerOf(result)
  const [endFx, setEndFx] = useState<EndFxEvent | null>(null)
  const [endSeen, setEndSeen] = useState(result.kind)
  if (endSeen !== result.kind) {
    setEndSeen(result.kind)
    if (endSeen === 'playing' && game) {
      if (!winner) setEndFx(endFxEvent('draw', null))
      else setEndFx(endFxEvent(winner === you ? 'win' : 'lose', you))
    }
  }

  // Báo sắp hết giờ (chỉ đồng hồ của người chơi).
  const lowWarned = useRef(false)
  useEffect(() => {
    if (!clock.control || flagAt === null || !playing || turn !== you) return
    const left = flagAt - now
    const limit = lowTime(clock.control)
    if (left > limit * 1.5) lowWarned.current = false
    else if (left < limit && left > 0 && !lowWarned.current) {
      lowWarned.current = true
      playSound('lowTime')
    }
  }, [now, flagAt, turn, you, clock.control, playing])

  useEffect(() => {
    if (!confirm) return
    const timer = setTimeout(() => setConfirm(null), 3000)
    return () => clearTimeout(timer)
  }, [confirm])

  // Đi một nước (người hay máy): ghi nước đi và giờ. Lỡ hết giờ rồi thì không nhận.
  const play = useCallback(
    (move: PlayedMove) => {
      const time = Date.now()
      if (flagAt !== null && time >= flagAt) return
      playMove(describeMove(chess, move))
      setMoves((prev) => [...prev, move])
      setClock((prev) => recordMove(prev, chess.turn(), time))
    },
    [chess, flagAt],
  )
  const playRef = useRef(play)
  useEffect(() => {
    playRef.current = play
  }, [play])

  // Giờ mới nhất cho lượt nghĩ của máy (đổi cùng lúc với các nước đi, nên không cần hỏi lại máy khi giờ đổi).
  const clockRef = useRef(clock)
  useEffect(() => {
    clockRef.current = clock
  }, [clock])

  // Tới lượt máy: hỏi máy một nước rồi đi. Đi lại, ván mới, rời trang thì huỷ lượt nghĩ đang dở.
  const uciMoves = useMemo(() => moves.map(toUci), [moves])
  useEffect(() => {
    const engine = engineRef.current
    if (!botTurn || !engine || engineError) return
    const abort = new AbortController()
    const start = Date.now()
    // Ván có đồng hồ (và đồng hồ đã chạy): máy biết giờ của mình để chia, không thua vì hết giờ.
    const latest = clockRef.current
    const flag = flagTime(latest, bot)
    const times = lastTimes(latest)
    const botClock: BotClock | undefined =
      flag !== null && times && latest.control
        ? { left: flag - start, increment: latest.control.increment * 1000, opponent: times[other(bot)] }
        : undefined
    const wait = naturalWait(Math.random, botClock)
    setThinking(true)
    botMove(engine, uciMoves, botElo, abort.signal, Math.random, botClock)
      .then(async (uci) => {
        const left = wait - (Date.now() - start)
        if (left > 0) await new Promise((resolve) => setTimeout(resolve, left))
        if (abort.signal.aborted || !uci) return
        playRef.current(fromUci(uci))
      })
      .catch(() => {
        if (!abort.signal.aborted) setEngineError(true)
      })
      .finally(() => {
        if (!abort.signal.aborted) setThinking(false)
      })
    return () => {
      abort.abort()
      setThinking(false)
    }
  }, [botTurn, bot, uciMoves, botElo, engineError, retry])

  const config = useMemo<Config>(() => {
    if (picking) return { orientation: boardSide, movable: { color: undefined, dests: new Map() } }
    const locked = !playing || botTurn || review.reviewing
    const last = shownChess.history({ verbose: true }).at(-1)
    return {
      fen: shownChess.fen(),
      orientation: boardSide,
      turnColor: SIDE[shownChess.turn()],
      check: shownChess.inCheck(),
      lastMove: last ? [last.from, last.to] : undefined,
      movable: {
        color: locked ? undefined : SIDE[you],
        dests: locked ? new Map() : legalDests(shownChess),
      },
      drawable: { autoShapes: reviewShapes(reviewed, review.shown) },
    }
  }, [shownChess, boardSide, playing, botTurn, picking, review.reviewing, review.shown, you, reviewed])

  function clockFace(color: Color): ClockFace | null {
    const last = lastTimes(clock)
    if (!clock.control || !last || !game) return null
    const running = flagAt !== null && color === turn
    const ms = running ? Math.min(last[color], Math.max(0, flagAt - now)) : last[color]
    return { ms, running: running && !over, low: ms < lowTime(clock.control) }
  }

  function endClocks(): Record<Color, number> | null {
    const white = clockFace('w')
    const black = clockFace('b')
    return white && black ? { w: white.ms, b: black.ms } : null
  }

  function goTo(ply: number) {
    review.go(ply)
    showBoard()
  }

  function handleMove(from: Key, to: Key) {
    const move = { from: from as Square, to: to as Square }
    if (isPromotion(chess, move.from, move.to)) {
      setPromotion(move)
      return
    }
    play(move)
  }

  function pickPromotion(type: PieceSymbol) {
    if (!promotion) return
    play({ ...promotion, promotion: type })
    setPromotion(null)
  }

  // Bắt đầu ván theo lựa chọn đang chọn. Ngẫu nhiên thì bốc màu lúc này.
  function start() {
    const side: Color = colorChoice === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : colorChoice
    setGame({ side, elo })
    setMoves([])
    setClock(newClock(control))
    setResigned(false)
    setPromotion(null)
    setFlipped(false)
    setConfirm(null)
    engineRef.current?.newGame().catch(() => undefined)
    playSound('start')
  }

  // Đi lại: lùi về lượt mình gần nhất. Máy đang nghĩ thì lùi nước mình vừa đi; máy đã đáp thì lùi cả nước máy.
  const undoCount = botTurn ? (moves.length > 0 ? 1 : 0) : moves.length >= 2 ? 2 : 0
  function undo() {
    if (undoCount === 0) return
    setPromotion(null)
    setMoves((prev) => prev.slice(0, -undoCount))
    setClock((prev) => {
      let next = prev
      for (let i = 0; i < undoCount; i++) next = undoMove(next, Date.now())
      return next
    })
  }

  function resign() {
    if (confirm !== 'resign') {
      setConfirm('resign')
      return
    }
    setConfirm(null)
    setResigned(true)
  }

  // Ván mới: về bảng chọn. Đang chơi dở thì hỏi lại (bấm lần nữa).
  function newGame() {
    if (playing && moves.length > 0 && confirm !== 'new') {
      setConfirm('new')
      return
    }
    setConfirm(null)
    setGame(null)
    setMoves([])
    setResigned(false)
    setPromotion(null)
    setFlipped(false)
  }

  // Bấm Phân tích ở bảng kết quả trên bàn cờ: bật máy chấm, cuộn tới thẻ kết quả (điện thoại nằm dưới bàn cờ).
  function analyse() {
    analysis.start()
    requestAnimationFrame(() => document.querySelector('.result')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
  }

  function retryEngine() {
    setEngineError(false)
    setRetry((n) => n + 1)
  }

  const feedbackState = game ? describeGame(result, clock.control) : 'chưa bắt đầu'
  const feedbackGame = useMemo(() => ({ sans, side: boardSide, state: `chơi với máy ${tierName(botElo)} ${eloLabel(botElo)} Elo, ${feedbackState}` }), [sans, boardSide, botElo, feedbackState])
  useFeedbackGame(feedbackGame)

  const statusLine = engineError
    ? 'Không tải được máy.'
    : botTurn
      ? thinking
        ? 'Máy đang nghĩ…'
        : 'Đang tải máy…'
      : status.kind === 'playing' && status.check
        ? 'Bạn đang bị chiếu!'
        : 'Tới lượt bạn'

  return (
    <div className="app">
      <TopBar mode="bot" />

      <main className="table">
        <section className="board-col">
          <PlayerBar
            color={top}
            name={top === you ? yourName : botName}
            rival={top === you ? botName : yourName}
            fallback={top === you ? 'Bạn' : undefined}
            label={name(top)}
            captured={captured[top]}
            score={material[top].score}
            active={playing && turn === top}
            clock={clockFace(top)}
          />
          <div className={`board-frame${review.reviewing ? ' board-frame--review' : ''}`}>
            <Board config={config} onMove={handleMove} />
            {picking && <PromotionPicker color={turn} onPick={pickPromotion} onCancel={() => setPromotion(null)} />}
            <EndFx
              event={endFx}
              end={over ? { winner } : undefined}
              chess={chess}
              orientation={boardSide}
              reviewing={review.reviewing}
              title={!winner ? 'Hòa' : winner === you ? 'Bạn thắng!' : 'Bạn thua'}
              reason={resultReason(result, name)}
              onNew={start}
              newLabel="Chơi lại"
              onAnalyse={analysis.state.status === 'idle' ? analyse : undefined}
            />
          </div>
          <PlayerBar
            color={bottom}
            name={bottom === you ? yourName : botName}
            rival={bottom === you ? botName : yourName}
            fallback={bottom === you ? 'Bạn' : undefined}
            label={name(bottom)}
            captured={captured[bottom]}
            score={material[bottom].score}
            active={playing && turn === bottom}
            clock={clockFace(bottom)}
          />
          <div className="board-under">
            <MoveStrip sans={sans} times={clock.spent} shown={review.shown} onGo={review.go} marks={marks} />
            <BoardTools onFlip={() => setFlipped((f) => !f)} />
          </div>
        </section>

        <aside className="side">
          {!game ? (
            <BotSetup
              elo={elo}
              onElo={setElo}
              color={colorChoice}
              onColor={setColorChoice}
              control={control}
              onControl={setControl}
              onStart={start}
            />
          ) : (
            <>
              {over ? (
                <ResultCard
                  result={result}
                  name={name}
                  chess={chess}
                  sans={sans}
                  times={clock.spent}
                  clocks={endClocks()}
                  orientation={boardSide}
                  shown={review.shown}
                  onGo={goTo}
                  analysis={analysis}
                />
              ) : (
                <div className={`status${status.kind === 'playing' && status.check && !botTurn ? ' status--check' : ''}`} role="status">
                  <span className="status__text">{statusLine}</span>
                  {engineError && (
                    <span className="status__hint status__hint--warn">
                      Kiểm tra mạng rồi{' '}
                      <button type="button" className="link-button" onClick={retryEngine}>
                        thử lại
                      </button>
                    </span>
                  )}
                  {review.reviewing && (
                    <span className="status__hint">
                      Đang xem lại thế cờ cũ.{' '}
                      <button type="button" className="link-button" onClick={() => review.go(moves.length)}>
                        Về ván đang chơi
                      </button>
                    </span>
                  )}
                  <span className="status__clock">
                    {botName}
                    {clock.control ? ` · ${describeControl(clock.control)}` : ''}
                  </span>
                </div>
              )}

              <div className="controls">
                {playing ? (
                  <>
                    <button type="button" className="btn" onClick={undo} disabled={undoCount === 0}>
                      Đi lại
                    </button>
                    <button type="button" className={`btn${confirm === 'resign' ? ' btn--confirm' : ''}`} onClick={resign} disabled={moves.length === 0}>
                      {confirm === 'resign' ? 'Bấm lần nữa' : 'Đầu hàng'}
                    </button>
                    <button type="button" className={`btn btn--primary${confirm === 'new' ? ' btn--confirm' : ''}`} onClick={newGame}>
                      {confirm === 'new' ? 'Bấm lần nữa' : 'Ván mới'}
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" className="btn" onClick={newGame}>
                      Đổi mức
                    </button>
                    <button type="button" className="btn btn--primary" onClick={start}>
                      Chơi lại
                    </button>
                  </>
                )}
              </div>

              <MoveList sans={sans} times={clock.spent} shown={review.shown} onGo={review.go} marks={marks} />
            </>
          )}

          <p className="credits">Máy cờ: Stockfish 19 (GPL), chạy ngay trong trình duyệt, bản stockfish.js của Nathan Rugg và Chess.com.</p>
        </aside>
      </main>
      <PageFoot />
    </div>
  )
}
