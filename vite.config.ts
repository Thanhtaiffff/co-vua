/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { defineConfig, type Plugin } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// `npm run build:single` gộp cả web vào đúng một file HTML: bấm đúp là chơi được, không cần mạng
// (phần chơi online thì dùng máy chủ giả và một bạn bè ảo). `npm run build:demo` cũng vậy nhưng mở sẵn trang chơi online,
// `npm run build:bot` mở sẵn trang chơi với máy (máy cờ Stockfish cũng bị nhúng vào file, nên file nặng hơn).
// Bản thường thì để file tiếng và ảnh chủ đề riêng, không nhét vào code: có nhiều bộ, máy chỉ tải bộ đang dùng.
// `npm run dev` chuyển các địa chỉ /api (chơi online) sang máy chủ chạy bằng `npm run dev:server`.

// Bản web ghi vào góp ý, để biết người góp ý đang dùng bản nào: mã commit khi Cloudflare dựng web, còn dựng trên máy
// thì ghi ngày giờ dựng (giờ Việt Nam).
function appVersion(mode: string): string {
  const commit = process.env.WORKERS_CI_COMMIT_SHA?.slice(0, 7)
  if (commit) return commit
  const time = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short' })
  const name: Record<string, string> = { production: 'tự dựng', development: 'đang làm', demo: 'bản chơi thử', bot: 'bản chơi thử', single: 'bản một file' }
  return `${name[mode] ?? mode} ${time}`
}

// Bản một file: file .wasm của máy cờ (1,8 MB) nén gzip trước khi nhúng, cho trang nhẹ bớt. Máy tự giải nén
// lúc chạy (xem src/engine/stockfish.ts).
function gzipWasm(): Plugin {
  return {
    name: 'gzip-wasm',
    enforce: 'pre',
    load(id) {
      const [file, query] = id.split('?')
      if (!file.endsWith('.wasm') || query !== 'url') return null
      const data = gzipSync(readFileSync(file), { level: 9 }).toString('base64')
      return `export default ${JSON.stringify(`data:application/gzip;base64,${data}`)}`
    },
  }
}

export default defineConfig(({ mode }) => {
  const single = mode === 'single' || mode === 'demo' || mode === 'bot'
  return {
    plugins: single ? [gzipWasm(), react(), viteSingleFile()] : [react()],
    define: { __APP_VERSION__: JSON.stringify(appVersion(mode)) },
    build: single
      ? { outDir: `dist-${mode}` }
      : { assetsInlineLimit: (file) => (file.endsWith('.mp3') || file.includes('/src/themes/') ? false : undefined) },
    server: { proxy: { '/api': { target: 'http://127.0.0.1:8787', ws: true } } },
  }
})
