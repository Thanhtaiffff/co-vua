// "Bộ não" máy cờ: Stockfish 18 (bản lite, một luồng) chạy ngay trong trình duyệt của người chơi, trong một Web Worker
// (một "tab ngầm" riêng, nên lúc máy nghĩ trang web không bị đơ). Không gửi gì lên máy chủ.
//
// Dùng chung cho chơi với máy (src/bot) và phân tích ván. Mỗi `new Engine()` là một máy riêng (một Worker riêng), nên
// bot và phân tích không giành nhau. Máy chỉ tải (khoảng 7 MB, trình duyệt nhớ cho lần sau) khi được hỏi lần đầu.
//
//   const engine = new Engine()
//   const a = await engine.analyse(fen, { depth: 12, multipv: 3 })
//   a.bestmove // 'e2e4', null nếu thế cờ đã hết nước
//   a.lines[0].score // { cp: 35 } hay { mate: 3 }, LUÔN theo góc nhìn Trắng
//   engine.dispose() // tắt máy khi rời trang
//
// File máy nằm ở src/engine/vendor (gói npm `stockfish` 18.0.8 của Nathan Rugg và Chess.com, giấy phép GPL-3.0 như web).
// Bản thường: Vite chép hai file vào /assets với tên có mã băm, nên đường tới file .wasm được gửi kèm sau dấu # cho máy.
// Bản một file (build:single, build:demo, build:bot): hai file bị nhúng thẳng vào trang dạng data: (file .wasm nén gzip,
// xem vite.config.ts), đổi thành blob: rồi mới chạy.
import engineJsUrl from './vendor/stockfish-18-lite-single.js?url'
import engineWasmUrl from './vendor/stockfish-18-lite-single.wasm?url'
import { fenTurn, mergeLine, parseBestmove, parseInfo, type Analysis } from './uci'

export type { Analysis, Line, Score } from './uci'

export type AnalyseOptions = {
  depth?: number // tính tới độ sâu này (số nước nhìn trước, tính cả hai bên)
  movetime?: number // nghĩ tối đa bấy nhiêu mili giây
  nodes?: number // xét tối đa bấy nhiêu thế cờ
  multipv?: number // cần mấy đường tốt nhất (mặc định 1)
  skill?: number // trình độ 0..20 của Stockfish (mặc định 20, mạnh nhất)
  elo?: number // bó sức máy theo Elo (Stockfish chỉ nhận 1320..3190); có thì `skill` bị bỏ qua
  moves?: string[] // các nước đi tiếp từ `fen` (dạng UCI); đưa cả ván thì máy biết luật lặp 3 lần
  signal?: AbortSignal // huỷ: máy dừng ngay và trả về kết quả đang có
  onUpdate?: (analysis: Analysis) => void // gọi mỗi khi máy tính sâu thêm (để hiện dần)
}

// Khoảng Elo mà Stockfish 18 tự bó sức được (kiểm bằng lệnh `uci`).
export const ENGINE_ELO_MIN = 1320
export const ENGINE_ELO_MAX = 3190

const EMPTY: Analysis = { bestmove: null, depth: 0, lines: [] }

// Không đưa giới hạn nào thì tính tới độ sâu này.
const DEFAULT_DEPTH = 15

type Job = { onLine: (line: string) => void; finish: (analysis: Analysis) => void }

async function toBlobUrl(dataUrl: string, type: string): Promise<string> {
  const response = await fetch(dataUrl)
  const body = dataUrl.startsWith('data:application/gzip') && response.body ? response.body.pipeThrough(new DecompressionStream('gzip')) : response.body
  const data = await new Response(body).arrayBuffer()
  return URL.createObjectURL(new Blob([data], { type }))
}

// Địa chỉ để mở Worker: file máy, sau dấu # là đường tới file .wasm.
async function workerUrl(): Promise<string> {
  const js = engineJsUrl.startsWith('data:') ? await toBlobUrl(engineJsUrl, 'text/javascript') : new URL(engineJsUrl, location.href).href
  const wasm = engineWasmUrl.startsWith('data:') ? await toBlobUrl(engineWasmUrl, 'application/wasm') : new URL(engineWasmUrl, location.href).href
  return `${js}#${encodeURIComponent(wasm)}`
}

// Máy trình duyệt có chạy được không (cần Web Worker và WebAssembly).
export function engineSupported(): boolean {
  return typeof Worker !== 'undefined' && typeof WebAssembly !== 'undefined'
}

export class Engine {
  private worker: Worker | null = null
  private booting: Promise<void> | null = null
  private waiters: { token: string; resolve: () => void }[] = []
  private job: Job | null = null
  private queue: Promise<unknown> = Promise.resolve()
  private failed: Error | null = null
  private disposed = false

  // Bật máy (nếu chưa bật) và chờ máy sẵn sàng. Gọi analyse() thì tự bật, không cần gọi hàm này trước;
  // gọi sớm để máy tải trong lúc người chơi còn đang chọn.
  ready(): Promise<void> {
    this.booting ??= this.boot()
    return this.booting
  }

  // Báo máy sắp sang ván khác (xoá bộ nhớ tạm của ván cũ).
  async newGame(): Promise<void> {
    await this.enqueue(async () => {
      await this.ready()
      this.send('ucinewgame')
      await this.sync()
    })
  }

  // Tính thế cờ `fen`. Gọi chồng nhiều lần thì tự xếp hàng, xong lần trước mới tới lần sau.
  analyse(fen: string, options: AnalyseOptions = {}): Promise<Analysis> {
    return this.enqueue(() => this.run(fen, options))
  }

  // Tắt máy. Lượt tính đang dở trả về kết quả đang có; gọi analyse() sau đó thì báo lỗi.
  dispose(): void {
    this.disposed = true
    this.failed ??= new Error('Máy đã tắt')
    this.worker?.terminate()
    this.worker = null
    this.job?.finish(EMPTY)
    this.waiters.splice(0).forEach((w) => w.resolve())
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const next = this.queue.then(task, task)
    this.queue = next.catch(() => undefined)
    return next
  }

  private async boot(): Promise<void> {
    if (this.disposed) throw this.failed
    if (!engineSupported()) throw (this.failed = new Error('Trình duyệt này không chạy được máy cờ'))
    const worker = new Worker(await workerUrl())
    if (this.disposed) {
      worker.terminate()
      throw this.failed
    }
    this.worker = worker
    worker.onmessage = (event: MessageEvent) => {
      const text = typeof event.data === 'string' ? event.data : ''
      for (const line of text.split('\n')) this.receive(line)
    }
    const failed = new Promise<never>((_, reject) => {
      worker.onerror = (event) => {
        event.preventDefault?.()
        this.failed = new Error('Không tải được máy cờ')
        this.job?.finish(EMPTY)
        reject(this.failed)
      }
    })
    failed.catch(() => undefined)
    await Promise.race([this.expect('uciok', 'uci'), failed])
    await Promise.race([this.sync(), failed])
  }

  private receive(line: string) {
    const trimmed = line.trim()
    if (!trimmed) return
    const waiter = this.waiters.find((w) => w.token === trimmed)
    if (waiter) {
      this.waiters.splice(this.waiters.indexOf(waiter), 1)
      waiter.resolve()
      return
    }
    this.job?.onLine(trimmed)
  }

  private send(command: string) {
    this.worker?.postMessage(command)
  }

  private expect(token: string, command: string): Promise<void> {
    return new Promise((resolve) => {
      this.waiters.push({ token, resolve })
      this.send(command)
    })
  }

  // Chờ máy làm xong các lệnh đã gửi.
  private sync(): Promise<void> {
    return this.expect('readyok', 'isready')
  }

  private async run(fen: string, options: AnalyseOptions): Promise<Analysis> {
    const { signal, moves = [] } = options
    if (signal?.aborted) return EMPTY
    await this.ready()
    if (this.failed) throw this.failed
    if (signal?.aborted) return EMPTY

    // Bên tới lượt sau các nước `moves`, để đổi điểm sang góc nhìn Trắng.
    const turn = moves.length % 2 === 0 ? fenTurn(fen) : fenTurn(fen) === 'w' ? 'b' : 'w'
    this.send(`setoption name MultiPV value ${Math.max(1, Math.min(10, Math.round(options.multipv ?? 1)))}`)
    this.send(`setoption name Skill Level value ${Math.max(0, Math.min(20, Math.round(options.skill ?? 20)))}`)
    // Luôn gửi cả hai, để lần hỏi trước có bó Elo cũng không dính sang lần sau.
    this.send(`setoption name UCI_LimitStrength value ${options.elo ? 'true' : 'false'}`)
    if (options.elo) this.send(`setoption name UCI_Elo value ${Math.max(ENGINE_ELO_MIN, Math.min(ENGINE_ELO_MAX, Math.round(options.elo)))}`)
    this.send(`position fen ${fen}${moves.length ? ` moves ${moves.join(' ')}` : ''}`)
    await this.sync()

    const limits: string[] = []
    if (options.depth) limits.push(`depth ${Math.round(options.depth)}`)
    if (options.movetime) limits.push(`movetime ${Math.round(options.movetime)}`)
    if (options.nodes) limits.push(`nodes ${Math.round(options.nodes)}`)
    if (limits.length === 0) limits.push(`depth ${DEFAULT_DEPTH}`)

    return new Promise<Analysis>((resolve) => {
      let lines: Analysis['lines'] = []
      const snapshot = (bestmove: string | null): Analysis => ({ bestmove, depth: lines[0]?.depth ?? 0, lines })
      const stop = () => this.send('stop')
      const finish = (analysis: Analysis) => {
        signal?.removeEventListener('abort', stop)
        this.job = null
        resolve(analysis)
      }
      this.job = {
        finish,
        onLine: (line) => {
          const info = parseInfo(line, turn)
          if (info) {
            lines = mergeLine(lines, info)
            options.onUpdate?.(snapshot(lines[0]?.pv[0] ?? null))
            return
          }
          const best = parseBestmove(line)
          if (best) finish(best.move ? snapshot(best.move) : EMPTY)
        },
      }
      signal?.addEventListener('abort', stop)
      this.send(`go ${limits.join(' ')}`)
    })
  }
}
