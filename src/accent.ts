export function applyAccent(accent = 'blue') {
  const value = ['zinc', 'blue', 'emerald', 'violet', 'amber', 'rose'].includes(accent) ? accent : 'blue'
  document.documentElement.dataset.accent = value
  localStorage.setItem('accent', value)
}
