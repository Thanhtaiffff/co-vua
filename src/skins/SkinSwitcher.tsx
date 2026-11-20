// Thanh đổi kiểu giao diện, chỉ có trong bản chơi thử: nằm nổi ở cạnh dưới màn hình, bấm ‹ › hay chọn trong danh sách.
import { useEffect, useState } from 'react'
import { loadSaved } from '../storage'
import { setTheme } from '../theme'
import { applySkin, savedSkin, SKINS } from './skins'
import './switcher.css'

export function SkinSwitcher() {
  const [skin, setSkin] = useState(savedSkin)
  const index = SKINS.indexOf(skin)

  // Lần đầu mở bản chơi thử (chưa chọn chủ đề bàn cờ) thì dùng bàn cờ hợp với kiểu đang xem.
  useEffect(() => {
    if (loadSaved<unknown>('theme', null) === null) setTheme(savedSkin().suggest)
  }, [])

  function pick(next: number) {
    const chosen = SKINS[(next + SKINS.length) % SKINS.length]
    applySkin(chosen)
    setTheme(chosen.suggest)
    setSkin(chosen)
  }

  return (
    <div className="skinbar" role="group" aria-label="Đổi kiểu giao diện">
      <button type="button" className="skinbar__step" onClick={() => pick(index - 1)} aria-label="Kiểu trước">
        ‹
      </button>
      <label className="skinbar__pick">
        <span className="skinbar__num">
          {index + 1}/{SKINS.length}
        </span>
        <select value={skin.id} onChange={(e) => pick(SKINS.findIndex((s) => s.id === e.target.value))} aria-label="Kiểu giao diện">
          {SKINS.map((s, i) => (
            <option key={s.id} value={s.id}>
              {i + 1}. {s.name}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className="skinbar__step" onClick={() => pick(index + 1)} aria-label="Kiểu sau">
        ›
      </button>
    </div>
  )
}
