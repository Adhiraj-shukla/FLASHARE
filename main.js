// Entry point: wires peer, signalling, transfer, profile and UI together.
import { Peer, DEFAULT_STUN } from './peer.js';
import { Transfer } from './transfer.js';
import { linkFor, codeFromHash, extractCode } from './signal.js';
import { drawQr } from './qr.js';
import { demoChannel } from './demo-channel.js';
import * as profile from './profile.js';
import * as ui from './ui.js';
const { $ } = ui;

let transfer = null;
profile.applyTheme(); ui.renderMe(); ui.setStep(1);

const peer = new Peer({
  state: ui.setStatus,
  open: dc => {
    transfer = new Transfer(dc, ui);
    transfer.sendHello(profile.get());
    ui.showSession();
    ui.chat('system', 'Connected. You can send files and messages.');
  },
  close: () => {},
  ice: () => $('noStun').checked ? [] : [{ urls: $('stun').value.trim() || DEFAULT_STUN }],
  message: e => transfer && transfer.onMessage(e),
});

ui.bindProfile(profile, () => {
  ui.renderMe();
  if (transfer) transfer.sendHello(profile.get()); // peer sees profile changes live
});

const demo = demoChannel(async m => {
  if (!$('demo').checked) return;
  if (m.k == 'offer' && !peer.pc) {
    $('offIn').value = m.code;
    const answer = await makeAnswer(m.code);
    if (answer) demo.post({ k: 'answer', code: answer });
  }
  if (m.k == 'answer' && peer.awaitingAnswer) { $('ansIn').value = m.code; applyAnswer(m.code); }
});
if (!demo.available) $('demo').disabled = true;

async function makeOffer() {
  const code = await peer.createOffer();
  $('offerOut').value = code; $('offerBox').classList.remove('hide'); ui.setStep(2);
  showQr('offerQr', 'offerQrNote', linkFor(code));
  if ($('demo').checked) demo.post({ k: 'offer', code });
}
async function applyAnswer(code) {
  try { await peer.acceptAnswer(code); }
  catch (e) { ui.setStatus('failed', 'Bad answer code: ' + e.message); }
}
async function makeAnswer(code) {
  try {
    const a = await peer.createAnswer(code);
    $('ansOut').value = a; $('ansBox').classList.remove('hide'); ui.setStep(3);
    showQr('ansQr', 'ansQrNote', a);
    return a;
  } catch (e) { ui.setStatus('failed', 'Bad offer code: ' + e.message); }
}

$('tS').onclick = () => ui.setTab(true);
$('tR').onclick = () => ui.setTab(false);
$('mkOffer').onclick = makeOffer;
$('applyAns').onclick = () => applyAnswer($('ansIn').value);
$('mkAns').onclick = () => makeAnswer($('offIn').value);
ui.copyButton('cpOffer', () => $('offerOut').value, 'Copy code');
ui.copyButton('cpAns', () => $('ansOut').value, 'Copy code');
ui.copyButton('cpLink', () => linkFor($('offerOut').value), 'Copy link');
ui.bindDrop(files => transfer && transfer.sendAll(files));

// QR: the offer QR holds a link (so a phone camera can open it); the answer QR holds the bare code.
const showQr = (canvas, note, text) => drawQr($(canvas), text)
  .then(() => { $(canvas).classList.remove('hide'); $(note).classList.remove('hide'); }).catch(() => {});
$('scanAns').onclick = () => ui.openScanner('Scan the receiver\'s answer QR', t => { const c = extractCode(t); $('ansIn').value = c; applyAnswer(c); });
$('scanOff').onclick = () => ui.openScanner('Scan the sender\'s offer QR', t => { const c = extractCode(t); $('offIn').value = c; makeAnswer(c); });

const sendMsg = () => {
  const t = $('msg').value.trim();
  if (t && transfer && transfer.sendText(t)) { ui.chat('you', t); $('msg').value = ''; }
};
$('sendMsg').onclick = sendMsg;
$('msg').onkeydown = e => { if (e.key == 'Enter') sendMsg(); };

const linked = codeFromHash();
if (linked) { ui.setTab(false); $('offIn').value = linked; }
