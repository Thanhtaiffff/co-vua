// Các kiểu giao diện (skin). Mỗi kiểu là một file CSS trong thư mục này, đặt lại màu, chữ, chất liệu trong
// :root[data-skin='<id>'] (xem material.css). Bản chơi thử có thanh đổi kiểu (SkinSwitcher) để so sánh; bản thật sẽ
// chỉ giữ kiểu Tài chọn.
import { loadSaved, save } from '../storage'
import type { Theme } from '../theme'

export type Skin = {
  id: string
  name: string
  note: string // một câu tả kiểu này
  bar: string // màu thanh trình duyệt trên điện thoại (thẻ theme-color), trùng màu nền
  suggest: Partial<Theme> // bàn cờ và quân hợp với kiểu này (bản chơi thử tự đổi theo; người chơi vẫn đổi được ở nút Chủ đề)
}

export const SKINS: Skin[] = [
  { id: 'san-dau', name: 'Sân đấu', note: 'Đêm chung kết: xanh đêm, vàng giải đấu, chữ in hoa như bảng tỉ số.', bar: '#0a1430', suggest: { board: 'glass-marbles', pieces: 'classic', style: '2d' } },
  { id: 'cau-lac-bo', name: 'Câu lạc bộ', note: 'Phòng cờ cổ: gỗ óc chó, đồng thau, chữ có chân.', bar: '#1f150f', suggest: { board: 'wood', pieces: 'wood', style: '3d', shape: 'round' } },
  { id: 'giay-trang', name: 'Giấy trắng', note: 'Trắng sạch, một màu xanh cobalt, không thừa gì.', bar: '#f4f5f7', suggest: { board: 'polished-stone-gray', pieces: 'classic', style: '2d' } },
  { id: 'via-he', name: 'Cờ vỉa hè', note: 'Góc cờ vỉa hè: gạch lát, ghế nhựa đỏ xanh, chữ tròn mập.', bar: '#e7e2d6', suggest: { board: 'classic', pieces: 'classic', style: '2d' } },
  { id: 'bien-ban', name: 'Biên bản', note: 'Tờ ghi biên bản ván đấu: giấy kẻ ô, mực bút máy xanh, lề đỏ.', bar: '#fbfcff', suggest: { board: 'crystal', pieces: 'classic', style: '2d' } },
  { id: 'arcade', name: 'Máy 8-bit', note: 'Máy điện tử thùng: tím đêm, xanh neon, chữ điểm ảnh, góc vuông.', bar: '#140b2b', suggest: { board: '8bit', pieces: '8bit', style: '2d' } },
  { id: 'be-tong', name: 'Bê tông', note: 'Xám bê tông, viền đen dày, bóng đổ cứng, cam công trường.', bar: '#dcdcd7', suggest: { board: 'stone-table', pieces: 'classic', style: '2d' } },
  { id: 'cuc-quang', name: 'Cực quang', note: 'Bầu trời cực quang nhiều màu, các khối là kính mờ.', bar: '#0b1026', suggest: { board: 'thick-glass', pieces: 'classic', style: '2d' } },
  { id: 'keo-ngot', name: 'Kẹo ngọt', note: 'Pastel hồng, tím, bạc hà; nút bấm nổi như viên kẹo.', bar: '#f6efff', suggest: { board: 'bubble', pieces: 'bubble', style: '3d', shape: 'round' } },
  { id: 'neon', name: 'Neon đêm', note: 'Đen tuyền, viền neon hồng và xanh phát sáng như phố đêm.', bar: '#06050b', suggest: { board: 'cast-iron', pieces: 'classic', style: '2d' } },
]

export function savedSkin(): Skin {
  const id = loadSaved<unknown>('skin', SKINS[0].id)
  return SKINS.find((skin) => skin.id === id) ?? SKINS[0]
}

export function applySkin(skin: Skin): void {
  document.documentElement.dataset.skin = skin.id
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = 'theme-color'
    document.head.append(meta)
  }
  meta.content = skin.bar
  save('skin', skin.id)
}
