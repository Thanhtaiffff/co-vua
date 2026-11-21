// Đọc chữ Stockfish trả về (giao thức UCI) thành dữ liệu. Tách riêng khỏi phần chạy máy để kiểm thử được mà không cần
// chạy Stockfish thật.

// Điểm thế cờ, LUÔN tính theo góc nhìn Trắng: cp là phần trăm con tốt (+150 là Trắng hơn khoảng 1,5 con tốt),
// mate là còn mấy nước thì chiếu bí (+3 là Trắng chiếu bí sau 3 nước, -2 là Đen chiếu bí sau 2 nước).
export type Score = { cp: number } | { mate: number }

// Một đường đi máy tính ra: multipv là thứ hạng (1 là nước tốt nhất), pv là chuỗi nước đi dạng UCI ('e2e4', 'e7e8q').
export type Line = { multipv: number; depth: number; score: Score; pv: string[] }

export type Analysis = {
  bestmove: string | null // nước máy chọn; null khi thế cờ đã hết nước (chiếu bí, pat)
  depth: number // độ sâu đã tính xong của đường tốt nhất
  lines: Line[] // xếp theo multipv 1..n
}

// Bên tới lượt trong một FEN ('w' hay 'b').
export function fenTurn(fen: string): 'w' | 'b' {
  return fen.split(' ')[1] === 'b' ? 'b' : 'w'
}

// Đọc một dòng "info ..." có điểm và đường đi. Stockfish cho điểm theo bên tới lượt; `turn` là bên tới lượt để đổi
// sang góc nhìn Trắng. Dòng không có đủ điểm và đường đi (vd "info string ...", "info currmove ...") thì trả null.
// Dòng có "lowerbound"/"upperbound" là điểm tạm chưa chắc, cũng bỏ.
export function parseInfo(line: string, turn: 'w' | 'b'): Line | null {
  const words = line.trim().split(/\s+/)
  if (words[0] !== 'info') return null
  let depth = 0
  let multipv = 1
  let score: Score | null = null
  let pv: string[] = []
  for (let i = 1; i < words.length; i++) {
    const word = words[i]
    if (word === 'depth') depth = Number(words[++i])
    else if (word === 'multipv') multipv = Number(words[++i])
    else if (word === 'score') {
      const kind = words[++i]
      const value = Number(words[++i])
      const sign = turn === 'w' ? 1 : -1
      if (kind === 'cp') score = { cp: value * sign || 0 }
      else if (kind === 'mate') score = { mate: value * sign || 0 }
      if (words[i + 1] === 'lowerbound' || words[i + 1] === 'upperbound') return null
    } else if (word === 'pv') {
      pv = words.slice(i + 1)
      break
    } else if (word === 'string') return null
  }
  if (!score || pv.length === 0 || !Number.isFinite(depth) || !Number.isFinite(multipv)) return null
  return { multipv, depth, score, pv }
}

// Đọc dòng "bestmove e2e4 ponder e7e5". Thế cờ hết nước thì Stockfish trả "bestmove (none)": trả null.
export function parseBestmove(line: string): { move: string | null } | null {
  const words = line.trim().split(/\s+/)
  if (words[0] !== 'bestmove') return null
  const move = words[1]
  return { move: move && move !== '(none)' && move !== '0000' ? move : null }
}

// Gộp một đường mới vào danh sách đường đang có (thay đường cùng thứ hạng), giữ thứ tự theo thứ hạng.
export function mergeLine(lines: Line[], line: Line): Line[] {
  const next = lines.filter((l) => l.multipv !== line.multipv)
  next.push(line)
  next.sort((a, b) => a.multipv - b.multipv)
  return next
}
