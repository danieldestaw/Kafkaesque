/** Abstract wave art for the login hero panel — matches reference layout. */
export function LoginHeroArt() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#0c2d5c]" aria-hidden>
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 400 600"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="wave-pink" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e879a8" />
            <stop offset="50%" stopColor="#f472b6" />
            <stop offset="100%" stopColor="#fb923c" />
          </linearGradient>
          <linearGradient id="wave-gold" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
          <linearGradient id="wave-blue" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
        </defs>
        <ellipse cx="280" cy="180" rx="220" ry="160" fill="url(#wave-pink)" opacity="0.85" />
        <ellipse cx="120" cy="320" rx="180" ry="140" fill="url(#wave-gold)" opacity="0.75" />
        <ellipse cx="300" cy="420" rx="200" ry="130" fill="url(#wave-blue)" opacity="0.6" />
        <path
          d="M-20 500 Q120 380 260 460 T520 420 L520 620 L-20 620 Z"
          fill="url(#wave-pink)"
          opacity="0.5"
        />
      </svg>
      <div className="absolute inset-0 bg-gradient-to-t from-[#0c2d5c]/90 via-transparent to-transparent" />
    </div>
  )
}
