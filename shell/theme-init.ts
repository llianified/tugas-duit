
export const THEME_STORAGE_KEY = 'tugas-duit-theme'

export const THEME_DARK_QUERY = '(prefers-color-scheme: dark)'

export const THEME_INIT_SCRIPT = `try{var p=localStorage.getItem('${THEME_STORAGE_KEY}');var d=p==='dark'||(p!=='light'&&window.matchMedia('${THEME_DARK_QUERY}').matches);document.documentElement.dataset.theme=d?'dark':'light'}catch(e){document.documentElement.dataset.theme='light'}`
