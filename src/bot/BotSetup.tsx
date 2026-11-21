// Bảng chọn trước ván chơi với máy: mức của máy, màu quân, thời gian. Ít chữ: mỗi mức chỉ là số và tên ngắn.
import type { Color } from 'chess.js'
import { Piece } from '../components/Piece'
import { TimeControlPicker } from '../components/TimeControlPicker'
import { controlLabel, type TimeControl } from '../game/clock'
import { BOT_LEVELS } from './levels'

export type ColorChoice = Color | 'random'

type Props = {
  level: number
  onLevel: (id: number) => void
  color: ColorChoice
  onColor: (color: ColorChoice) => void
  control: TimeControl | null
  onControl: (control: TimeControl | null) => void
  onStart: () => void
}

const COLORS: { value: ColorChoice; label: string }[] = [
  { value: 'w', label: 'Trắng' },
  { value: 'random', label: 'Ngẫu nhiên' },
  { value: 'b', label: 'Đen' },
]

function ColorBadge({ color }: { color: ColorChoice }) {
  return (
    <span className={`cg-wrap color-badge${color === 'random' ? ' color-badge--random' : ''}`} aria-hidden="true">
      {color === 'random' ? (
        <>
          <Piece type="k" color="w" />
          <Piece type="k" color="b" />
        </>
      ) : (
        <Piece type="k" color={color} />
      )}
    </span>
  )
}

export function BotSetup({ level, onLevel, color, onColor, control, onControl, onStart }: Props) {
  return (
    <div className="bot-setup">
      <div className="card" role="group" aria-labelledby="bot-level-title">
        <p className="card__heading" id="bot-level-title">
          Mức của máy
        </p>
        <div className="bot-levels">
          {BOT_LEVELS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`bot-level${item.id === level ? ' bot-level--on' : ''}`}
              aria-pressed={item.id === level}
              onClick={() => onLevel(item.id)}
            >
              <span className="bot-level__num">{item.id}</span>
              <span className="bot-level__name">{item.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="card" role="group" aria-labelledby="bot-color-title">
        <p className="card__heading" id="bot-color-title">
          Bạn cầm quân
        </p>
        <div className="color-choices">
          {COLORS.map((choice) => (
            <button
              key={choice.value}
              type="button"
              className={`color-choice${color === choice.value ? ' color-choice--on' : ''}`}
              aria-pressed={color === choice.value}
              onClick={() => onColor(choice.value)}
            >
              <ColorBadge color={choice.value} />
              <span>{choice.label}</span>
            </button>
          ))}
        </div>
      </div>

      <button type="button" className="btn btn--primary btn--big" onClick={onStart}>
        Chơi
      </button>

      {/* Chơi với máy thường không tính giờ (như chess.com), nên bảng chọn giờ gập lại, ai cần thì mở. */}
      <details className="bot-time">
        <summary className="bot-time__summary">
          <span>Thời gian</span>
          <span className="bot-time__value">{control ? controlLabel(control) : 'Không tính giờ'}</span>
        </summary>
        <TimeControlPicker value={control} onChange={onControl} />
      </details>
    </div>
  )
}
