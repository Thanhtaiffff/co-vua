// Logo của web: vương miện ba đỉnh tròn, đỉnh giữa màu cam, đặt trên tấm kính bo góc (mẫu R3, Tài chọn 2026-11-26).
// Cùng hình với biểu tượng trên tab trình duyệt (public/favicon.svg). Vẽ thẳng trong trang để nét ở mọi cỡ.
export function BrandMark() {
  return (
    <svg className="brand__mark" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="brand-glass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fdfcfa" />
          <stop offset=".55" stopColor="#ebe8e3" />
          <stop offset="1" stopColor="#d6d2cb" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="19" fill="url(#brand-glass)" />
      <path d="M17 41L15 25L24.5 33L32 21L39.5 33L49 25L47 41Z" fill="#121211" stroke="#121211" strokeWidth="3" strokeLinejoin="round" />
      <rect x="16" y="44" width="32" height="6.5" rx="3.25" fill="#121211" />
      <circle cx="14.5" cy="21.5" r="3.6" fill="#121211" />
      <circle cx="49.5" cy="21.5" r="3.6" fill="#121211" />
      <circle cx="32" cy="16" r="4.2" fill="#ff5a1f" />
      <rect x="3.1" y="3.1" width="57.8" height="57.8" rx="17.9" fill="none" stroke="#fff" strokeOpacity=".85" strokeWidth="1.2" />
    </svg>
  )
}
