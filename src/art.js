const CUP = 'M16 10H122L111 146Q110 154 102 154H36Q28 154 27 146Z'
const CUP_TOP = 10
const CUP_BOTTOM = 154
const DROP = 'M12 1.5C12 1.5 2.5 13 2.5 20.2a9.5 9.5 0 0 0 19 0C21.5 13 12 1.5 12 1.5Z'
export const TANK_WIDTH = 172
export const TANK_HEIGHT = 250

// A wave whose crest line sits at y and extends one wavelength past both edges, so it can drift seamlessly.
function wave(y, amplitude, length, width) {
  let path = `M${-length} ${y}`
  for (let x = -length; x < width + length; x += length) path += `q${length / 4} ${-amplitude} ${length / 2} 0t${length / 2} 0`
  return `${path}V${y + 420}H${-length}Z`
}

function bubbles(width, count) {
  return Array.from({ length: count }, (_, index) => {
    const x = width * (0.2 + 0.6 * (((index * 37) % 100) / 100))
    const y = 24 + ((index * 53) % 100) * 1.1
    const radius = 1.6 + (index % 3) * 1.1
    return `<circle class="bubble" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${radius.toFixed(1)}" style="animation-delay:${(-index * 0.7).toFixed(1)}s"/>`
  }).join('')
}

export const glassLevel = (fraction) =>
  fraction <= 0 ? CUP_BOTTOM + 12 : CUP_BOTTOM - Math.min(fraction, 1) * (CUP_BOTTOM - CUP_TOP)

export function glassSvg(id, level, goal) {
  const ticks = Array.from({ length: Math.max(goal - 1, 0) }, (_, index) => {
    const y = CUP_BOTTOM - ((index + 1) / goal) * (CUP_BOTTOM - CUP_TOP)
    const x = 122 - ((y - CUP_TOP) * 11) / 136
    return `<path d="M${(x - 15).toFixed(1)} ${y.toFixed(1)}H${(x - 5).toFixed(1)}"/>`
  }).join('')
  return `<svg class="glass" viewBox="0 0 138 160" aria-hidden="true" focusable="false">
    <defs>
      <clipPath id="cup-${id}"><path d="${CUP}"/></clipPath>
      <linearGradient id="water-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#74e8d8"/><stop offset="1" stop-color="#0e8a82"/></linearGradient>
    </defs>
    <path class="cup-fill" d="${CUP}"/>
    <g clip-path="url(#cup-${id})">
      <g class="water" style="--level:${level.toFixed(1)}">
        <path class="wave back" d="${wave(-3, 5, 95, 138)}"/>
        <path class="wave" d="${wave(0, 6, 95, 138)}" fill="url(#water-${id})"/>
        ${bubbles(138, 6)}
      </g>
    </g>
    <g class="ticks">${ticks}</g>
    <path class="cup-edge" d="${CUP}"/>
    <path class="cup-glare" d="M30 24L39 132"/>
  </svg>`
}

// Water tops out just below the avatar and name so they stay readable in both themes.
export const tankLevel = (fraction) =>
  fraction <= 0 ? TANK_HEIGHT + 12 : TANK_HEIGHT - Math.min(fraction, 1) * (TANK_HEIGHT - 112)

export function tankSvg(id, level) {
  return `<svg class="tank-water" viewBox="0 0 ${TANK_WIDTH} ${TANK_HEIGHT}" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <defs><linearGradient id="tank-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4fdcca"/><stop offset="1" stop-color="#0c6f69"/></linearGradient></defs>
    <g class="water" style="--level:${level.toFixed(1)}">
      <path class="wave back" d="${wave(-4, 6, 95, TANK_WIDTH)}"/>
      <path class="wave" d="${wave(0, 7, 95, TANK_WIDTH)}" fill="url(#tank-${id})"/>
      ${bubbles(TANK_WIDTH, 8)}
    </g>
  </svg>`
}

export function dropSvg(id, fraction, future) {
  const offset = Math.min(Math.max(fraction, 0), 1)
  return `<svg class="drop${future ? ' future' : ''}" viewBox="0 0 24 32" aria-hidden="true" focusable="false">
    <defs><linearGradient id="drop-${id}" x1="0" y1="1" x2="0" y2="0"><stop offset="${offset}" class="drop-on"/><stop offset="${offset}" class="drop-off"/></linearGradient></defs>
    <path d="${DROP}" fill="url(#drop-${id})"/>
  </svg>`
}

export const miniGlassSvg = () => `<svg class="mini-glass" viewBox="0 0 32 40" aria-hidden="true" focusable="false">
  <path class="mini-water" d="M8.3 17H23.7L22.2 33Q22 35 20 35H12Q10 35 9.8 33Z"/>
  <path class="mini-cup" d="M5 5H27L24.2 34.4Q24 37 21.4 37H10.6Q8 37 7.8 34.4Z"/>
</svg>`
