// Bảng chọn trước ván chơi với máy: sức của máy (số Elo, thanh trượt như chess.com), màu quân, thời gian. Ít chữ.
import type { CSSProperties } from 'react'
import type { Color } from 'chess.js'
import { Piece } from '../components/Piece'
import { TimeControlPicker } from '../components/TimeControlPicker'
import { controlLabel, type TimeControl } from '../game/clock'
import { clampElo, ELO_MAX, ELO_MIN, ELO_STEP } from './levels'

export type ColorChoice = Color | 'random'

type Props = {
  elo: number
  onElo: (elo: number) => void
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

// Số Elo to ở giữa, dưới là thanh kéo, hai bên có nút − + để chỉnh từng nấc (trên điện thoại kéo khó dừng đúng số).
function EloSlider({ value, onChange }: { value: number; onChange: (elo: number) => void }) {
  const percent = ((value - ELO_MIN) / (ELO_MAX - ELO_MIN)) * 100
  const nudge = (by: number) => onChange(clampElo(value + by))
  return (
    <div className="elo">
      <output className="elo__value" htmlFor="bot-elo" aria-live="polite">
        {value}
        <span className="elo__unit">Elo</span>
      </output>
      <div className="elo__row">
        <button type="button" className="elo__step" aria-label="Yếu hơn" disabled={value <= ELO_MIN} onClick={() => nudge(-ELO_STEP)}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12h14" />
          </svg>
        </button>
        <input
          id="bot-elo"
          className="elo__range"
          type="range"
          min={ELO_MIN}
          max={ELO_MAX}
          step={ELO_STEP}
          value={value}
          aria-labelledby="bot-level-title"
          aria-valuetext={`${value} Elo`}
          style={{ '--fill': `${percent}%` } as CSSProperties}
          onChange={(event) => onChange(clampElo(Number(event.target.value)))}
        />
        <button type="button" className="elo__step" aria-label="Mạnh hơn" disabled={value >= ELO_MAX} onClick={() => nudge(ELO_STEP)}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12h14M12 5v14" />
          </svg>
        </button>
      </div>
    </div>
  )
}

export function BotSetup({ elo, onElo, color, onColor, control, onControl, onStart }: Props) {
  return (
    <div className="bot-setup">
      <div className="card" role="group" aria-labelledby="bot-level-title">
        <p className="card__heading" id="bot-level-title">
          Sức của máy
        </p>
        <EloSlider value={elo} onChange={onElo} />
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
