// All DOM work lives here.
import { get, avatarEl, safeAvatar, safeName } from './profile.js';
import { scanQr } from './qr.js';
export const $ = id => document.getElementById(id);

const fmt = n => n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : n < 1073741824 ? (n / 1048576).toFixed(1) + ' MB' : (n / 1073741824).toFixed(2) + ' GB';
const eta = s => !isFinite(s) ? '–' : s < 60 ? Math.ceil(s) + 's' : Math.floor(s / 60) + 'm ' + Math.ceil(s % 60) + 's';
let peer = { name: 'Peer', avatar: '' };

const ICONS = { idle: '○', connecting: '◌', connected: '✓', failed: '✕' };
const LABELS = { idle: 'Idle', connecting: 'Connecting', connected: 'Connected', failed: 'Failed' };
export function setStatus(kind, text) {
  $('link').className = 'card link s-' + kind;
  $('bIcon').textContent = ICONS[kind] || '○'; $('bTxt').textContent = LABELS[kind] || kind;
  $('stxt').textContent = text;
  if (kind == 'connected') setStep(4);
}
export function setStep(n) {
  [...$('steps').children].forEach((li, i) => {
    li.classList.toggle('done', i < n - 1);
    if (i == n - 1) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
  });
}

export function renderMe() {
  const p = get(), name = p.name || 'You';
  avatarEl($('meAv'), p); avatarEl($('meBtnAv'), p);
  $('meName').textContent = name; $('meBtnName').textContent = name;
}

export function setPeer(m) {
  peer = { name: safeName(m.name) || 'Peer', avatar: safeAvatar(m.avatar) };
  const a = $('peerAv'); a.classList.remove('ghost'); avatarEl(a, peer);
  $('peerName').textContent = peer.name;
}

export function showSession() {
  $('sess').classList.remove('hide'); $('chat').classList.remove('hide'); $('setup').classList.add('hide');
}

export function setTab(send) {
  $('pS').classList.toggle('hide', !send); $('pR').classList.toggle('hide', send);
  $('tS').classList.toggle('on', send); $('tR').classList.toggle('on', !send);
}
export const isReceiveTab = () => !$('pR').classList.contains('hide');

export function addRow(id, name, size, dir) {
  const d = document.createElement('div'); d.className = 'tr';
  d.innerHTML = '<div class="h"><b></b><span class="size"></span></div><progress value="0" max="1"></progress>' +
    '<div class="meta"><output class="speed">–</output><span class="gauge" aria-hidden="true"><i></i></span><span class="eta"></span></div><div class="st"></div>';
  d.querySelector('b').textContent = (dir == 'out' ? '↑ ' : '↓ ') + name;
  d.querySelector('.size').textContent = fmt(size);
  $('trs').prepend(d);
  const q = s => d.querySelector(s);
  return { d, t0: performance.now(), last: 0, size, peak: 1, st: q('.st'), bar: q('progress'), out: q('output'), gauge: q('.gauge i'), eta: q('.eta') };
}

export function progress(r, done) {
  const now = performance.now();
  if (now - r.last < 100 && done < r.size) return; // throttle DOM updates
  r.last = now;
  const speed = done / ((now - r.t0) / 1000 || 1), pct = Math.round(done / (r.size || 1) * 100);
  r.peak = Math.max(r.peak, speed);
  r.bar.value = done / (r.size || 1);
  r.out.value = fmt(speed) + '/s';
  r.gauge.style.width = Math.round(speed / r.peak * 100) + '%';
  r.eta.textContent = pct + '% · ' + eta((r.size - done) / speed) + ' left';
}

export const note = (r, text) => { r.st.textContent = text; };

export function sentDone(r) { r.st.textContent = 'Sent · receiver is verifying SHA-256'; }
export function interrupted(r) { r.st.textContent = 'Interrupted – connection closed'; }

export function recvDone(r, { ok, hash, url, name }) {
  r.st.textContent = '';
  const s = document.createElement('span'); s.className = ok ? 'ok' : 'no';
  s.textContent = ok ? '✓ Integrity verified (SHA-256) ' : '✗ Hash mismatch – file corrupted ';
  const a = document.createElement('a'); a.href = url; a.download = name; a.textContent = 'Save file';
  const h = document.createElement('div'); h.className = 'hash'; h.textContent = hash;
  r.st.append(s, a, h);
}

export function chat(who, text) {
  const l = $('log'), m = document.createElement('div'); m.className = 'msg ' + who;
  if (who == 'system') m.textContent = text;
  else {
    const av = document.createElement('div'); av.className = 'av xs'; avatarEl(av, who == 'you' ? get() : peer);
    const b = document.createElement('div'); b.className = 'bub'; b.textContent = text;
    m.append(av, b);
  }
  l.append(m); l.scrollTop = l.scrollHeight;
}

export function copyButton(btn, getText, label) {
  const b = $(btn);
  b.onclick = async () => {
    const text = getText(); let ok = true;
    try { await navigator.clipboard.writeText(text); }
    catch { // Clipboard API unavailable (insecure origin / denied): fall back to a hidden textarea
      ok = false; const t = document.createElement('textarea'); t.value = text; t.style.cssText = 'position:fixed;opacity:0';
      document.body.append(t); t.select(); try { ok = document.execCommand('copy'); } catch {} t.remove();
    }
    b.textContent = ok ? '✓ Copied' : 'Select the text and copy it manually'; b.classList.toggle('copied', ok);
    setTimeout(() => { b.textContent = label; b.classList.remove('copied'); }, 1500);
  };
}

export function bindDrop(onFiles) {
  const dz = $('drop');
  dz.onclick = () => $('pick').click();
  dz.onkeydown = e => { if (e.key == 'Enter' || e.key == ' ') $('pick').click(); };
  $('pick').onchange = e => { onFiles([...e.target.files]); e.target.value = ''; };
  ['dragover', 'dragenter'].forEach(v => dz.addEventListener(v, e => { e.preventDefault(); dz.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(v => dz.addEventListener(v, e => { e.preventDefault(); dz.classList.remove('over'); }));
  dz.addEventListener('drop', e => onFiles([...e.dataTransfer.files]));
}

// Profile dialog: P is the profile module, onChange runs after every edit.
export function bindProfile(P, onChange) {
  const d = $('prof'), box = $('themes');
  const sync = () => {
    const p = P.get(); avatarEl($('pAv'), p); $('pName').value = p.name;
    $('pAcc').value = /^#[0-9a-f]{6}$/i.test(p.accent) ? p.accent : P.THEMES[p.theme][3];
    [...box.children].forEach(b => b.setAttribute('aria-pressed', b.dataset.t == p.theme));
  };
  const edit = patch => { P.save(patch); sync(); onChange(); };
  for (const [k, [label, bg, ink, acc]] of Object.entries(P.THEMES)) {
    const b = document.createElement('button'); b.dataset.t = k; b.className = 'sw'; b.textContent = label;
    b.style.setProperty('--b', bg); b.style.setProperty('--k', ink); b.style.setProperty('--a', acc);
    b.onclick = () => edit({ theme: k, accent: '' }); box.append(b);
  }
  $('meBtn').onclick = () => { sync(); d.showModal(); };
  $('profDone').onclick = () => d.close();
  $('pName').oninput = e => edit({ name: P.safeName(e.target.value) });
  $('pAcc').oninput = e => edit({ accent: e.target.value });
  $('pAccReset').onclick = () => edit({ accent: '' });
  $('pRm').onclick = () => edit({ avatar: '' });
  $('pUp').onclick = () => $('pFile').click();
  $('pFile').onchange = async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try { $('pErr').textContent = 'Photos are cropped to a square and shared only with your peer.'; edit({ avatar: await P.resizeAvatar(f) }); }
    catch (err) { $('pErr').textContent = err.message; }
  };
}

// Camera scanner dialog. onCode receives the raw text of the first QR code found.
export async function openScanner(title, onCode) {
  const d = $('scan');
  $('scanTitle').textContent = title; $('scanMsg').textContent = 'Point the camera at the QR code.';
  let stop = () => {};
  const close = () => { stop(); if (d.open) d.close(); };
  $('scanCancel').onclick = close; d.onclose = () => stop();
  d.showModal();
  try {
    stop = await scanQr($('scanVideo'), text => { close(); onCode(text); },
      () => { $('scanMsg').textContent = 'Camera unavailable. Allow camera access (needs https), or paste the code instead.'; });
  } catch { $('scanMsg').textContent = 'The QR scanner could not load. Paste the code instead.'; }
  if (!d.open) stop();
}
