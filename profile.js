// Local profile: display name, avatar (resized to a small JPEG), theme and accent colour.
const KEY = 'flashare-profile';
// [label, background, text, accent] – used for the swatches in the profile dialog
export const THEMES = {
  mint:     ['Mint',     '#e8f0ea', '#14211b', '#0f7a5a'],
  midnight: ['Midnight', '#0d1220', '#e8ecf8', '#7aa2ff'],
  ember:    ['Ember',    '#181010', '#f7ebe4', '#ff8a4c'],
  lilac:    ['Lilac',    '#ece6fa', '#231a3d', '#6b43d6'],
};
const defaults = () => ({
  name: '', avatar: '', accent: '',
  theme: matchMedia('(prefers-color-scheme: dark)').matches ? 'midnight' : 'mint',
});
let p = load();

function load() {
  try { return { ...defaults(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch { return defaults(); }
}
export const get = () => p;

export function save(patch) {
  p = { ...p, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch {}
  applyTheme();
}

const lum = h => {
  const n = parseInt(h.slice(1), 16);
  const f = c => (c /= 255) <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
  return .2126 * f(n >> 16) + .7152 * f(n >> 8 & 255) + .0722 * f(n & 255);
};

export function applyTheme() {
  const r = document.documentElement;
  r.dataset.theme = THEMES[p.theme] ? p.theme : 'mint';
  if (/^#[0-9a-f]{6}$/i.test(p.accent)) {
    r.style.setProperty('--acc', p.accent);
    r.style.setProperty('--accink', lum(p.accent) > .5 ? '#111' : '#fff');
  } else { r.style.removeProperty('--acc'); r.style.removeProperty('--accink'); }
}

// Centre-crop to a square and downscale so the avatar is a few KB and cheap to send to the peer.
export function resizeAvatar(file, size = 96) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = c.height = size;
      const s = Math.min(img.width, img.height);
      c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', .82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('That file is not an image.')); };
    img.src = url;
  });
}

// Peer data is untrusted: accept only a small JPEG data URL.
export const safeAvatar = a => typeof a == 'string' && a.length < 30000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(a) ? a : '';
export const safeName = n => String(n || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 24);

// Fill an element with the avatar photo, or the person's initial.
export function avatarEl(el, { name, avatar }) {
  el.textContent = ''; el.style.backgroundImage = '';
  if (avatar) el.style.backgroundImage = 'url("' + avatar + '")';
  else el.textContent = (name || '?').trim().charAt(0).toUpperCase() || '?';
}
