const OTHER_TOKENS = ['flac', 'ogg', 'opus', 'alac', 'wav', 'pcm', 'aiff', 'ape']

function tokenizeUrl(url) {
  return String(url || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

export function guessStreamFormat(url) {
  const tokens = tokenizeUrl(url)
  if (!tokens.length) return ''
  if (tokens.includes('mp3')) return 'mp3'
  if (tokens.includes('aac') || tokens.includes('aacp') || tokens.includes('m4a')) return 'aac'
  if (tokens.some((token) => OTHER_TOKENS.includes(token))) return 'autre'
  return ''
}

export const FORMAT_OPTIONS = [
  { value: '', label: 'Auto' },
  { value: 'mp3', label: 'MP3' },
  { value: 'aac', label: 'AAC' },
  { value: 'autre', label: 'Autre' },
]
