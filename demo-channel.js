// Same-device demo: two tabs swap offer/answer over BroadcastChannel, no network or copy-paste.
export function demoChannel(onMessage) {
  const bc = 'BroadcastChannel' in window ? new BroadcastChannel('flashare-signal') : null;
  if (bc) bc.onmessage = e => onMessage(e.data);
  return { available: !!bc, post: m => bc && bc.postMessage(m) };
}
