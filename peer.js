// RTCPeerConnection + data channel lifecycle.
import { encode, decode } from './signal.js';
import { LOW } from './chunker.js';

export const DEFAULT_STUN = 'stun:stun.l.google.com:19302'; // optional, third-party, no guarantees

export class Peer {
  // handlers: { state(kind, text), open(dc), close(), message(event), ice() -> iceServers[] }
  constructor(handlers) { this.h = handlers; this.pc = null; this.dc = null; }

  get awaitingAnswer() {
    return !!this.pc && this.pc.localDescription?.type == 'offer' && !this.pc.currentRemoteDescription;
  }

  _create() {
    const pc = this.pc = new RTCPeerConnection({ iceServers: this.h.ice ? this.h.ice() : [] });
    this.h.state('connecting', 'Connecting…');
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s == 'failed' || s == 'disconnected') this.h.state('failed', 'Connection ' + s + ' – see troubleshooting');
      else if (s == 'closed') this.h.state('idle', 'Closed');
    };
    return pc;
  }

  // Non-trickle ICE: wait until gathering completes (null candidate or 'complete' state), with a 4 s safety timeout.
  _gathered() {
    const pc = this.pc;
    return new Promise(res => {
      if (pc.iceGatheringState == 'complete') return res();
      let t; const done = () => { clearTimeout(t); res(); };
      t = setTimeout(res, 4000);
      pc.onicecandidate = e => { if (!e.candidate) done(); };
      pc.onicegatheringstatechange = () => { if (pc.iceGatheringState == 'complete') done(); };
    });
  }

  _channel(ch) {
    this.dc = ch; ch.binaryType = 'arraybuffer';
    ch.bufferedAmountLowThreshold = LOW;
    ch.onopen = () => { this.h.state('connected', 'Connected'); this.h.open(ch); };
    ch.onclose = () => { this.h.state('failed', 'Channel closed'); this.h.close(); };
    ch.onmessage = e => this.h.message(e);
  }

  async createOffer() {
    this._create(); this._channel(this.pc.createDataChannel('file'));
    await this.pc.setLocalDescription(await this.pc.createOffer());
    await this._gathered();
    return encode({ type: 'offer', sdp: this.pc.localDescription.sdp });
  }

  async acceptAnswer(code) {
    const a = await decode(code);
    await this.pc.setRemoteDescription({ type: 'answer', sdp: a.sdp });
  }

  async createAnswer(code) {
    const o = await decode(code);
    this._create(); this.pc.ondatachannel = e => this._channel(e.channel);
    await this.pc.setRemoteDescription({ type: 'offer', sdp: o.sdp });
    await this.pc.setLocalDescription(await this.pc.createAnswer());
    await this._gathered();
    return encode({ type: 'answer', sdp: this.pc.localDescription.sdp });
  }
}
