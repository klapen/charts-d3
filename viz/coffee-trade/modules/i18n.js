const STORAGE_KEY = 'klapen.lang'
const SUPPORTED = ['en', 'es']

export function detectLang() {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored && SUPPORTED.includes(stored)) return stored
  const nav = (navigator.language || 'en').slice(0, 2).toLowerCase()
  return SUPPORTED.includes(nav) ? nav : 'en'
}

export function applyLang(lang) {
  document.documentElement.lang = lang
  for (const el of document.querySelectorAll(`[data-${lang}]`)) {
    const text = el.dataset[lang]
    if (text != null) el.textContent = text
  }
  for (const btn of document.querySelectorAll('.lang-btn')) {
    const active = btn.dataset.lang === lang
    btn.setAttribute('aria-pressed', active)
  }
  localStorage.setItem(STORAGE_KEY, lang)
}
