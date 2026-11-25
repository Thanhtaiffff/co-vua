// Kiểu hiệu ứng hết ván. Bản chơi thử (một file) có nút đổi kiểu để Tài chọn; web thật dùng kiểu mặc định.
//   medal: huy hiệu giữa bàn cờ (vương miện + pháo giấy), hiện 3 giây rồi tắt
//   king:  vua bên thua đổ nghiêng ngay trên bàn, vua bên thắng đội vương miện nhỏ; giữ nguyên tới ván mới
//   card:  như king, thêm bảng kết quả nhỏ nổi giữa bàn cờ (ai thắng, vì sao, nút Ván mới, Phân tích)
import { useSyncExternalStore } from 'react'
import { loadSaved, save } from '../storage'

export type EndStyle = 'medal' | 'king' | 'card'
export const END_STYLES: EndStyle[] = ['medal', 'king', 'card']

const DEMO = import.meta.env.MODE === 'single'
let current: EndStyle = DEMO ? loadSaved<EndStyle>('endStyle', 'card') : 'card'
if (!END_STYLES.includes(current)) current = 'card'
const listeners = new Set<() => void>()

export function setEndStyle(style: EndStyle): void {
  current = style
  save('endStyle', style)
  for (const listener of listeners) listener()
}

export function useEndStyle(): EndStyle {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => current,
  )
}
