import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@lichess-org/chessground/assets/chessground.base.css'
import '@lichess-org/chessground/assets/chessground.brown.css'
import '@lichess-org/chessground/assets/chessground.cburnett.css'
import './index.css'
import { Root } from './Root.tsx'
// Lớp chất liệu và các kiểu giao diện nạp sau cùng, sau CSS của mọi trang, để phủ lên.
import './skins/material.css'
import './skins/san-dau.css'
import './skins/cau-lac-bo.css'
import './skins/giay-trang.css'
import './skins/via-he.css'
import './skins/bien-ban.css'
import './skins/arcade.css'
import './skins/be-tong.css'
import './skins/cuc-quang.css'
import './skins/keo-ngot.css'
import './skins/neon.css'
import { applySkin, savedSkin } from './skins/skins'

// Đặt kiểu giao diện trước khi vẽ trang để khỏi chớp màu.
applySkin(savedSkin())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
