// Cho máy (Stockfish) xem lại cả ván sau khi hết ván: chấm điểm từng thế cờ, từ đầu tới cuối, rồi xếp loại từng nước
// (src/game/review.ts). Chỉ chạy khi người chơi bấm "Phân tích", vì máy phải nghĩ vài chục giây và làm nóng điện thoại.
// Ván đã phân tích thì nhớ lại (cả khi tải lại trang), bấm lại không phải chờ.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import { Engine } from './engine/stockfish'
import { finalScore, positions, reviewGame, toUci, type GameReview, type PositionEval } from './game/review'
import type { PlayedMove } from './game/rules'
import { loadSaved, save } from './storage'

// Máy nghĩ mỗi thế cờ tới độ sâu này (nhìn trước 16 nửa nước). Sâu hơn thì chính xác hơn nhưng lâu hơn nhiều: thử trên
// máy tính, ván 33 nửa nước mất 3,5 giây ở độ sâu 14, 10 giây ở 16, 27 giây ở 18 (một máy cờ; hai máy song song thì độ sâu
// 16 còn 5 giây). Điện thoại chậm hơn vài lần.
export const REVIEW_DEPTH = 16
// Giới hạn thời gian cho một thế cờ, để điện thoại yếu không phải chờ quá lâu ở thế cờ rắc rối.
const MAX_MS = 1000

// Máy có từ 4 nhân trở lên thì cho hai máy cờ chạy song song (nhanh gấp đôi), máy yếu hơn thì một.
function engineCount(): number {
  return (navigator.hardwareConcurrency ?? 1) >= 4 ? 2 : 1
}

export type ReviewState =
  | { status: 'idle' }
  | { status: 'running'; done: number; total: number }
  | { status: 'done'; review: GameReview }
  | { status: 'error' }

export type GameReviewApi = {
  state: ReviewState
  start: () => void
  cancel: () => void
}

type Saved = { key: string; evals: PositionEval[] }

const keyOf = (moves: PlayedMove[]) => moves.map(toUci).join(' ')

// Ván phân tích gần nhất, giữ trong bộ nhớ và trên máy.
let last: Saved | null = loadSaved<Saved | null>('review', null)

function remembered(moves: PlayedMove[]): GameReview | null {
  if (!last || last.key !== keyOf(moves)) return null
  try {
    return reviewGame(moves, last.evals)
  } catch {
    return null
  }
}

// `moves`: cả ván (null khi ván chưa xong: chưa cho phân tích, tránh dùng máy để gian lận lúc đang chơi).
export function useGameReview(moves: PlayedMove[] | null): GameReviewApi {
  const key = moves ? keyOf(moves) : ''
  const [run, setRun] = useState<{ key: string; state: ReviewState } | null>(null)
  const abort = useRef<AbortController | null>(null)

  const stored = useMemo(() => (moves && moves.length > 0 ? remembered(moves) : null), [moves])

  const cancel = useCallback(() => {
    abort.current?.abort()
    abort.current = null
    setRun(null)
  }, [])

  // Ván đổi (ván mới, đi lại) hay rời trang thì thôi phân tích ván cũ.
  useEffect(() => () => abort.current?.abort(), [key])

  const start = useCallback(() => {
    if (!moves || moves.length === 0) return
    abort.current?.abort()
    const controller = new AbortController()
    abort.current = controller
    const { signal } = controller
    const fens = positions(moves)
    const total = fens.length
    setRun({ key, state: { status: 'running', done: 0, total } })

    // Thế cờ đã hết ván (chiếu bí, pat, lặp lại 3 lần...) thì tự cho điểm, khỏi hỏi máy.
    const chess = new Chess()
    const finals = [finalScore(chess)]
    for (const move of moves) {
      chess.move(move)
      finals.push(finalScore(chess))
    }

    const evals: (PositionEval | undefined)[] = new Array(total)
    let next = 0
    let done = 0
    const engines = Array.from({ length: engineCount() }, () => new Engine())

    // Mỗi máy lần lượt nhận thế cờ kế tiếp chưa ai xem, tới khi hết.
    async function work(engine: Engine) {
      await engine.newGame()
      while (!signal.aborted && next < total) {
        const i = next++
        const final = finals[i]
        if (final) evals[i] = { score: final, best: null }
        else {
          const result = await engine.analyse(fens[i], { depth: REVIEW_DEPTH, movetime: MAX_MS, signal })
          if (signal.aborted) return
          evals[i] = { score: result.lines[0]?.score ?? { cp: 0 }, best: result.bestmove }
        }
        done++
        setRun({ key, state: { status: 'running', done, total } })
      }
    }

    void (async () => {
      try {
        await Promise.all(engines.map(work))
        if (signal.aborted) return
        const all = evals as PositionEval[]
        last = { key, evals: all }
        save('review', last)
        setRun({ key, state: { status: 'done', review: reviewGame(moves, all) } })
      } catch {
        if (!signal.aborted) setRun({ key, state: { status: 'error' } })
      } finally {
        for (const engine of engines) engine.dispose()
        if (abort.current === controller) abort.current = null
      }
    })()
  }, [moves, key])

  let state: ReviewState = { status: 'idle' }
  if (run && run.key === key) state = run.state
  else if (stored) state = { status: 'done', review: stored }
  return { state, start, cancel }
}
