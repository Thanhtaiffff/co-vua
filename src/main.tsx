import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@lichess-org/chessground/assets/chessground.base.css'
import '@lichess-org/chessground/assets/chessground.brown.css'
import '@lichess-org/chessground/assets/chessground.cburnett.css'
import './index.css'
import { Root } from './Root.tsx'
// Lớp chất liệu và các kiểu giao diện nạp sau cùng, sau CSS của mọi trang, để phủ lên.
import './skins/material.css'
import './skins/glass.css'
import './skins/be-tong-kinh.css'
import './skins/be-tong.css'
import { liteMode } from './skins/lite'

// Mức hiệu ứng (Bê tông kính đầy đủ có mép bẻ cong / bớt kính / Bê tông gốc) theo lựa chọn Tự động, Đẹp, Nhẹ trong bảng Chủ đề, xem
// skins/lite.ts.
liteMode()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
