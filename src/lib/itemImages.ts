const itemIcons: { pattern: RegExp; icon: string }[] = [
  { pattern: /foam display board|poster board|display board|poster/i, icon: '🪧' },
  { pattern: /banner stand|banner/i, icon: '🏳️' },
  { pattern: /trestle table|folding table/i, icon: '🪑' },
  { pattern: /chalkboard/i, icon: '📝' },
  { pattern: /kettle/i, icon: '🫖' },
  { pattern: /string light|fairy light|festoon/i, icon: '✨' },
  { pattern: /bunting/i, icon: '🏳️' },
  { pattern: /speaker/i, icon: '🔊' },
  { pattern: /microphone/i, icon: '🎤' },
  { pattern: /serving tray|tray/i, icon: '🍽️' },
  { pattern: /tool kit|tool set|hand tool/i, icon: '🧰' },
  { pattern: /sports ball|ball assortment/i, icon: '⚽' },
  { pattern: /sewing machine/i, icon: '🧵' },
  { pattern: /projector/i, icon: '📽️' },
  { pattern: /stage riser/i, icon: '🎭' },
  { pattern: /queue barrier/i, icon: '🚧' },
]

const categoryIcons: Record<string, string> = {
  'Display & signage': '🪧',
  Furniture: '🪑',
  'Lighting & decor': '✨',
  'Audio & tech': '🔊',
  'Stage & event': '🎭',
  'Catering & serving': '🍽️',
  'Workshop & tools': '🧰',
  'Outdoor & sports': '⚽',
  'Costumes & textiles': '🧵',
  'Power & accessories': '🔌',
}

const palettes = [
  ['#56866d', '#a9c78f', '#e7f0e1'],
  ['#568295', '#a8cdd2', '#e3eff0'],
  ['#987456', '#dfb681', '#f4ebdc'],
  ['#81709b', '#c4b4d7', '#eee9f3'],
  ['#99725e', '#e0b2a0', '#f4e8e2'],
  ['#78884e', '#c3ce8d', '#edf0df'],
  ['#50788a', '#9dc2cc', '#e3eef0'],
]

function escapeXml(value: string) {
  return value.replace(/[<>&"']/g, (character) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    '"': '&quot;',
    "'": '&apos;',
  })[character] ?? character)
}

export function itemImageForItem(name: string, category: string, variant = 0) {
  const icon = itemIcons.find((rule) => rule.pattern.test(name))?.icon
    ?? categoryIcons[category]
    ?? '♻️'
  const hash = Array.from(name).reduce((sum, character) => sum + character.charCodeAt(0), 0)
  const [primary, secondary, background] = palettes[(hash + variant) % palettes.length]
  const title = escapeXml(name)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500"><defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="${background}"/><stop offset="1" stop-color="#fffdf7"/></linearGradient><filter id="shadow" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#33443a" flood-opacity=".18"/></filter></defs><rect width="800" height="500" fill="url(#bg)"/><circle cx="665" cy="112" r="56" fill="#fff" opacity=".46"/><circle cx="120" cy="370" r="75" fill="${secondary}" opacity=".16"/><rect x="230" y="75" width="340" height="275" rx="48" fill="#fff" opacity=".62" filter="url(#shadow)"/><text x="400" y="270" text-anchor="middle" font-family="'Segoe UI Emoji','Apple Color Emoji',sans-serif" font-size="150">${icon}</text><rect x="28" y="426" width="744" height="52" rx="15" fill="#fff" opacity=".93"/><circle cx="54" cy="452" r="7" fill="${primary}"/><text x="76" y="459" fill="#3d4c42" font-family="Arial,sans-serif" font-size="22" font-weight="700">${title}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

export function itemImageForCategory(category: string, variant = 0) {
  return itemImageForItem(category, category, variant)
}
