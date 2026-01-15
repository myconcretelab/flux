function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex).trim())
  if (!m) return null
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) }
}

function srgbToLinear(c) {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

function luminance(rgb) {
  const r = srgbToLinear(rgb.r)
  const g = srgbToLinear(rgb.g)
  const b = srgbToLinear(rgb.b)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrastRatio(L1, L2) {
  const a = Math.max(L1, L2) + 0.05
  const b = Math.min(L1, L2) + 0.05
  return a / b
}

function clampChannel(value) {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function rgbToHex(rgb) {
  const toHex = (c) => clampChannel(c).toString(16).padStart(2, '0')
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`
}

export function pickReadableText(bgHex) {
  const bg = hexToRgb(bgHex)
  if (!bg) return '#111827'
  const contrastBlack = contrastRatio(luminance(bg), luminance({ r: 0, g: 0, b: 0 }))
  const contrastWhite = contrastRatio(luminance(bg), luminance({ r: 255, g: 255, b: 255 }))
  return contrastWhite >= contrastBlack ? '#ffffff' : '#111827'
}

export function tintColor(hex, amount = 0.85) {
  const rgb = hexToRgb(hex)
  if (!rgb) return null
  const t = Math.max(0, Math.min(1, amount))
  return rgbToHex({
    r: rgb.r + (255 - rgb.r) * t,
    g: rgb.g + (255 - rgb.g) * t,
    b: rgb.b + (255 - rgb.b) * t,
  })
}
