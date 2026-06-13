export function renderQuantumLogo() {
  return `
    <div style="position: relative; width: 100%; max-width: 420px; height: 420px; margin: 2rem auto; display: flex; align-items: center; justify-content: center; pointer-events: none; select: none;">
      
      <div style="position: absolute; inset: 0; border-radius: 50%; border: 1px solid rgba(6,182,212,0.3); background: gradient(to tr, rgba(6,182,212,0.1), rgba(192,132,252,0.1)); filter: drop-shadow(0 0 40px rgba(6,182,212,0.15)); animation: pulse 4s ease-in-out infinite;"></div>
      
      <svg style="position: absolute; width: 100%; height: 100%; filter: drop-shadow(0 0 20px rgba(34,211,238,0.5));" viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="quantumGlow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#22d3ee" stop-opacity="0.8" />
            <stop offset="50%" stop-color="#fbbf24" stop-opacity="0.6" />
            <stop offset="100%" stop-color="#c084fc" stop-opacity="0.7" />
          </linearGradient>
        </defs>

        <circle cx="200" cy="200" r="130" stroke="url(#quantumGlow)" stroke-width="1" stroke-dasharray="4 12" />
        <circle cx="200" cy="200" r="100" stroke="#38bdf8" stroke-width="0.5" stroke-opacity="0.4" />

        <g>
          <path d="M 130,140 L 270,140 L 245,165 L 215,165 L 215,265 L 200,280 L 185,265 L 185,165 L 155,165 Z" stroke="url(#quantumGlow)" stroke-width="2.5" stroke-linejoin="round" />
          <path d="M 165,185 L 235,185 M 175,210 L 225,210" stroke="#22d3ee" stroke-width="1.5" stroke-dasharray="2 4" />
          <polygon points="200,152 210,165 200,178 190,165" fill="#ffffff" opacity="0.9" />
        </g>

        <path d="M 110,200 Q 155,120 200,200 T 290,200" stroke="url(#quantumGlow)" stroke-width="1" stroke-opacity="0.4" />
      </svg>
    </div>
  `;
}
