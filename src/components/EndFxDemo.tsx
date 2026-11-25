// Chỉ có trong bản chơi thử (một file): bảng nhỏ góc dưới để đổi kiểu hiệu ứng hết ván và chạy thử một ván ngắn
// (thắng, thua, hòa). Chọn xong kiểu thì bỏ file này.
import type { PlayedMove } from '../game/rules'
import { END_STYLES, setEndStyle, useEndStyle, type EndStyle } from './endStyle'

export const END_DEMO = import.meta.env.MODE === 'single'

const LABEL: Record<EndStyle, string> = { medal: 'A · Huy hiệu', king: 'B · Vua đổ', card: 'C · Vua đổ + bảng' }

const line = (text: string): PlayedMove[] =>
  text.split(' ').map((m) => ({ from: m.slice(0, 2), to: m.slice(2, 4) }) as PlayedMove)

// Trắng là "Bạn". Thắng: chiếu bí 4 nước. Thua: chiếu bí 2 nước. Hòa: hết nước đi (pat) sau 10 nước.
export const DEMO_GAMES = {
  win: line('e2e4 e7e5 f1c4 b8c6 d1h5 g8f6 h5f7'),
  lose: line('f2f3 e7e5 g2g4 d8h4'),
  draw: line('e2e3 a7a5 d1h5 a8a6 h5a5 h7h5 h2h4 a6h6 a5c7 f7f6 c7d7 e8f7 d7b7 d8d3 b7b8 d3h7 b8c8 f7g6 c8e6'),
}
export type DemoGame = keyof typeof DEMO_GAMES

export function EndFxDemo({ onTry }: { onTry: (game: DemoGame) => void }) {
  const style = useEndStyle()
  return (
    <div className="endfx-demo">
      <div className="endfx-demo__row">
        {END_STYLES.map((s) => (
          <button key={s} type="button" className={`endfx-demo__pick${s === style ? ' is-on' : ''}`} onClick={() => setEndStyle(s)}>
            {LABEL[s]}
          </button>
        ))}
      </div>
      <div className="endfx-demo__row">
        <span className="endfx-demo__label">Thử:</span>
        <button type="button" className="endfx-demo__try" onClick={() => onTry('win')}>
          Bạn thắng
        </button>
        <button type="button" className="endfx-demo__try" onClick={() => onTry('lose')}>
          Bạn thua
        </button>
        <button type="button" className="endfx-demo__try" onClick={() => onTry('draw')}>
          Hòa
        </button>
      </div>
    </div>
  )
}
