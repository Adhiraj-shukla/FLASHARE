// Manual signalling. A full SDP is long, so a code keeps only what a data-channel connection needs:
// ICE user + password, DTLS fingerprint, DTLS role and the UDP candidates. The other side rebuilds a
// standard minimal SDP from it.
//
// Code format:  f<role>.<ufrag>.<pwd>.<fingerprint>.<candidates>
//   role: o = offer (actpass), a = answer (active), p = answer (passive)
//   fingerprint: SHA-256 as base64url (43 chars)
//   candidates: comma-separated  <type><address>_<port>  with type h=host s=srflx r=relay p=prflx
const b64u = b => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
// ICE strings only use A-Z a-z 0-9 + /, so mapping + / to - _ keeps codes URL-safe without ambiguity.
const safe = s => s.replace(/\+/g, '-').replace(/\//g, '_'), unsafe = s => s.replace(/-/g, '+').replace(/_/g, '/');
const T = { host: 'h', srflx: 's', relay: 'r', prflx: 'p' }, TT = { h: 'host', s: 'srflx', r: 'relay', p: 'prflx' };
const PREF = { host: 126, prflx: 110, srflx: 100, relay: 0 };
const ROLE = { offer_actpass: 'o', answer_active: 'a', answer_passive: 'p' };

export function encode({ type, sdp }) {
  const get = re => (sdp.match(re) || [])[1];
  const u = get(/^a=ice-ufrag:(\S+)/m), p = get(/^a=ice-pwd:(\S+)/m);
  const fp = get(/^a=fingerprint:sha-256 ([0-9A-Fa-f:]+)/m), setup = get(/^a=setup:(\w+)/m);
  const role = ROLE[type + '_' + setup];
  if (!u || !p || !fp || !role) throw new Error('Unsupported session description');
  const seen = new Set(), c = [];
  for (const m of sdp.matchAll(/^a=candidate:\S+ (\d+) (\w+) \d+ (\S+) (\d+) typ (\w+)/gm)) {
    const [, comp, proto, addr, port, typ] = m;
    if (comp != '1' || proto.toLowerCase() != 'udp' || !T[typ]) continue;
    const tok = T[typ] + addr + '_' + port;
    if (!seen.has(tok)) { seen.add(tok); c.push(tok); }
  }
  const fpBytes = fp.split(':').map(h => parseInt(h, 16));
  return ['f' + role, safe(u), safe(p), b64u(fpBytes), c.join(',')].join('.');
}

export function decode(code) {
  const parts = code.replace(/\s+/g, '').split('.');
  if (parts.length < 4 || parts[0][0] != 'f' || !'oap'.includes(parts[0][1])) throw new Error('Not a Flashare code');
  const [head, u, p, fp] = parts, cands = parts.slice(4).join('.');
  const type = head[1] == 'o' ? 'offer' : 'answer', setup = { o: 'actpass', a: 'active', p: 'passive' }[head[1]];
  const hex = [...unb64u(fp)].map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(':');
  const L = ['v=0', 'o=- 1 1 IN IP4 127.0.0.1', 's=-', 't=0 0', 'a=group:BUNDLE 0',
    'm=application 9 UDP/DTLS/SCTP webrtc-datachannel', 'c=IN IP4 0.0.0.0',
    'a=ice-ufrag:' + unsafe(u), 'a=ice-pwd:' + unsafe(p), 'a=fingerprint:sha-256 ' + hex,
    'a=setup:' + setup, 'a=mid:0', 'a=sctp-port:5000', 'a=max-message-size:262144'];
  cands.split(',').filter(Boolean).forEach((tok, i) => {
    const t = TT[tok[0]], body = tok.slice(1), k = body.lastIndexOf('_'), addr = body.slice(0, k), port = body.slice(k + 1);
    if (!t || !addr || !/^\d+$/.test(port)) throw new Error('Corrupted code');
    const prio = ((PREF[t] << 24) | ((65535 - i) << 8) | 255) >>> 0;
    L.push(`a=candidate:${i + 1} 1 udp ${prio} ${addr} ${port} typ ${t}` + (t == 'host' ? '' : ' raddr 0.0.0.0 rport 0'));
  });
  L.push('a=end-of-candidates');
  return { type, sdp: L.join('\r\n') + '\r\n' };
}

export const linkFor = code => location.href.split('#')[0] + '#o=' + code;
export const codeFromHash = () => location.hash.startsWith('#o=') ? location.hash.slice(3) : '';
// A scanned QR can hold either a bare code or a full link; return just the code.
export const extractCode = text => { const t = text.trim(), i = t.indexOf('#o='); return i >= 0 ? t.slice(i + 3) : t; };
