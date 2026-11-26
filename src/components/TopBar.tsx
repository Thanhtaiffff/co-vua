// Đầu trang dùng chung cho mọi trang: tên web, công tắc ba nấc Online | Một máy | Với máy, rồi các nút chỉ
// có hình (rê chuột vào mới hiện chữ): Mẹo và ghi công, Góp ý, chủ đề, bộ tiếng, loa. Lựa chọn chủ đề và âm thanh lưu
// trong máy, trang nào cũng dùng chung. Form góp ý và bảng mẹo cũng nằm ở đây (nút cuối trang trên điện thoại cũng mở
// hai bảng này).
import { useEffect, useState } from 'react'
import '../bot/bot.css'
import { FeedbackButton, FeedbackSheet } from '../feedback/FeedbackForm'
import { navigate } from '../router'
import { playSample, playSound, selectSoundSet, setSoundEnabled, setupSound, SOUND_SETS, type SoundSet } from '../sound'
import { loadSaved, save } from '../storage'
import { useTheme } from '../theme'
import { pieceSetInfo, type PieceSetId } from '../themeCatalog'
import { AboutButton, AboutSheet } from './AboutSheet'
import { BrandMark } from './BrandMark'
import { SoundSetPicker, type SoundMode } from './SoundSetPicker'
import { SoundToggle } from './SoundToggle'
import { ThemePicker } from './ThemePicker'

type Mode = 'online' | 'local' | 'bot'

type Props = {
  mode: Mode // trang đang mở: chơi online, chơi chung một máy hay chơi với máy
}

const MODES: { mode: Mode; path: string; label: string }[] = [
  { mode: 'online', path: '/online', label: 'Online' },
  { mode: 'local', path: '/', label: 'Một máy' },
  { mode: 'bot', path: '/may', label: 'Với máy' },
]

// Hình con robot nhỏ cho nấc Với máy (điện thoại chỉ còn hình này, không có chữ).
function BotIcon() {
  return (
    <svg className="mode__bot" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4.5" y="8" width="15" height="11" rx="3" />
      <path d="M12 8V4.5M9.5 19v1.5M14.5 19v1.5M2.5 12.5v2M21.5 12.5v2" />
      <circle cx="12" cy="3.8" r="1" fill="currentColor" stroke="none" />
      <circle cx="9.3" cy="12.8" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="14.7" cy="12.8" r="1.25" fill="currentColor" stroke="none" />
      <path d="M10 16.2h4" />
    </svg>
  )
}

// Máy đã chọn sẵn một bộ tiếng khác Gỗ (từ trước khi có chủ đề) thì giữ bộ đó; còn lại tiếng theo chủ đề.
function savedSoundMode(): SoundMode {
  const saved = loadSaved<unknown>('soundMode', null)
  if (saved === 'theme' || saved === 'fixed') return saved
  return loadSaved<unknown>('soundSet', 'wood') === 'wood' ? 'theme' : 'fixed'
}

export function TopBar({ mode }: Props) {
  const theme = useTheme()
  const [soundOn, setSoundOn] = useState<boolean>(() => loadSaved('sound', true))
  const [soundMode, setSoundMode] = useState<SoundMode>(savedSoundMode)
  // Bộ tiếng chọn riêng (dùng khi tiếng không theo chủ đề).
  const [soundSet, setSoundSet] = useState<SoundSet>(() => {
    const saved = loadSaved<unknown>('soundSet', 'wood')
    return SOUND_SETS.find((set) => set === saved) ?? 'wood'
  })
  const themeSound = pieceSetInfo(theme.pieces).sound
  const activeSet = soundMode === 'theme' ? themeSound : soundSet

  useEffect(() => save('sound', soundOn), [soundOn])
  useEffect(() => save('soundMode', soundMode), [soundMode])
  useEffect(() => save('soundSet', soundSet), [soundSet])
  useEffect(() => setSoundEnabled(soundOn), [soundOn])
  useEffect(() => {
    selectSoundSet(activeSet)
  }, [activeSet])
  useEffect(() => setupSound(), [])

  // Bật tiếng thì kêu thử một tiếng để biết là đã có tiếng.
  function toggleSound() {
    const on = !soundOn
    setSoundOn(on)
    setSoundEnabled(on)
    if (on) playSound('move')
  }

  // Chọn bộ tiếng (hay chọn "Theo chủ đề") thì bật tiếng luôn (nếu đang tắt). Bảng chọn tự cho nghe thử bộ mới.
  function pickSoundSet(set: SoundSet) {
    setSoundMode('fixed')
    setSoundSet(set)
    setSoundOn(true)
    setSoundEnabled(true)
  }

  function followTheme() {
    setSoundMode('theme')
    setSoundOn(true)
    setSoundEnabled(true)
  }

  // Đổi bộ quân khi tiếng đang theo chủ đề: cho nghe tiếng đi quân của bộ mới.
  function pickPieces(id: PieceSetId) {
    if (soundOn && soundMode === 'theme') playSample(pieceSetInfo(id).sound, [['move', 0]])
  }

  return (
    <header className="topbar">
      {/* Bấm logo hoặc tên web là về trang đầu (chơi chung một máy) */}
      <h1 className="brand">
        <a
          className="brand__link"
          href="/"
          aria-label="Cờ vua, về trang đầu"
          onClick={(e) => {
            e.preventDefault()
            navigate('/')
          }}
        >
          <BrandMark />
          <span className="brand__word">Cờ vua</span>
        </a>
      </h1>
      {/* Máy tính: công tắc ba nấc, nấc đang mở sáng lên. Điện thoại: ẩn nấc đang mở, nấc Với máy chỉ còn hình robot. */}
      <nav className="mode" aria-label="Chế độ chơi">
        {MODES.map((item) => (
          <a
            key={item.mode}
            className="mode__link"
            href={item.path}
            aria-label={item.mode === 'bot' ? 'Chơi với máy' : undefined}
            aria-current={item.mode === mode ? 'page' : undefined}
            onClick={(e) => {
              e.preventDefault()
              if (item.mode !== mode) navigate(item.path)
            }}
          >
            {item.mode === 'bot' ? (
              <BotIcon />
            ) : (
              <svg className="mode__swap" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 8.5h13.5l-3.2-3.2M19 15.5H5.5l3.2 3.2" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            <span className="mode__label">{item.label}</span>
          </a>
        ))}
      </nav>
      <div className="topbar__tools">
        <AboutButton place="top" />
        <FeedbackButton place="top" />
        <ThemePicker onPickPieces={pickPieces} />
        <SoundSetPicker
          value={activeSet}
          mode={soundMode}
          themeSet={themeSound}
          themeName={pieceSetInfo(theme.pieces).name}
          soundOn={soundOn}
          onChange={pickSoundSet}
          onFollowTheme={followTheme}
        />
        <SoundToggle on={soundOn} onToggle={toggleSound} />
      </div>
      <FeedbackSheet />
      <AboutSheet />
    </header>
  )
}
