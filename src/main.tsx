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
import { liquidGlass } from './skins/liquidGlass'
import { liteMode } from './skins/lite'

// Mép kính bẻ cong chỉ bật trên máy tính dùng Chrome, Edge (trình duyệt khác vẫn là kính mờ thường). Điện thoại dùng
// chế độ nhẹ cho khỏi giật, xem skins/lite.ts.
liquidGlass(liteMode() === 'full')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
