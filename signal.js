// Manual signalling: turn session descriptions into short copy-paste codes (deflate + base64url).
const CS = 'CompressionStream' in window;

export async function encode(obj) {
  let b = new TextEncoder().encode(JSON.stringify(obj));
  if (CS) b = new Uint8Array(await new Response(new Blob([b]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
  return (CS ? 'z' : 'p') + btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function decode(code) {
  const s = code.replace(/\s+/g, '');
  let b = Uint8Array.from(atob(s.slice(1).replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  if (s[0] == 'z') b = new Uint8Array(await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
  return JSON.parse(new TextDecoder().decode(b));
}

export const linkFor = code => location.href.split('#')[0] + '#o=' + code;
export const codeFromHash = () => location.hash.startsWith('#o=') ? location.hash.slice(3) : '';
