// File + text protocol on top of the data channel (message framing):
//   JSON text frames:  hello {name,avatar} | meta {id,name,size,type,hash} | end {id} | msg {text}
//   Binary frames:     raw 16 KB file chunks between a meta and its end frame
// SHA-256 is computed over the whole file (see integrity.js) before sending and after reassembly.
import { hashBlob } from './integrity.js';
import { readChunks, waitForDrain } from './chunker.js';

export class Transfer {
  // ui: { addRow, progress, note, sentDone, interrupted, recvDone, chat, setPeer }
  constructor(dc, ui) { this.dc = dc; this.ui = ui; this.cur = null; }

  sendHello(p) {
    if (this.dc.readyState == 'open') this.dc.send(JSON.stringify({ t: 'hello', name: p.name, avatar: p.avatar }));
  }

  sendText(text) {
    if (this.dc.readyState != 'open') return false;
    this.dc.send(JSON.stringify({ t: 'msg', text }));
    return true;
  }

  async sendAll(files) { for (const f of files) await this.sendFile(f); }

  async sendFile(f) {
    const dc = this.dc, id = crypto.randomUUID();
    const row = this.ui.addRow(id, f.name, f.size, 'out');
    this.ui.note(row, 'Calculating SHA-256…');
    const hash = await hashBlob(f);
    dc.send(JSON.stringify({ t: 'meta', id, name: f.name, size: f.size, type: f.type, hash }));
    row.t0 = performance.now(); this.ui.note(row, '');
    let sent = 0;
    for await (const buf of readChunks(f)) {
      await waitForDrain(dc);                       // backpressure
      if (dc.readyState != 'open') return this.ui.interrupted(row);
      dc.send(buf); sent += buf.byteLength;
      this.ui.progress(row, sent);
    }
    dc.send(JSON.stringify({ t: 'end', id }));
    this.ui.progress(row, f.size);
    this.ui.sentDone(row);
  }

  onMessage(e) {
    if (typeof e.data == 'string') {
      const m = JSON.parse(e.data);
      if (m.t == 'hello') return this.ui.setPeer(m);
      if (m.t == 'msg') return this.ui.chat('peer', m.text);
      if (m.t == 'meta') {
        this.cur = { name: m.name, type: m.type, size: m.size, hash: m.hash, parts: [], got: 0,
                     row: this.ui.addRow(m.id, m.name, m.size, 'in') };
      } else if (m.t == 'end' && this.cur) {
        const c = this.cur; this.cur = null;
        this.ui.progress(c.row, c.size); this.ui.note(c.row, 'Verifying SHA-256…');
        const blob = new Blob(c.parts, { type: c.type || 'application/octet-stream' }); c.parts = null;
        hashBlob(blob).then(actual => this.ui.recvDone(c.row,
          { ok: actual == c.hash, hash: actual, url: URL.createObjectURL(blob), name: c.name }));
      }
      return;
    }
    const c = this.cur; if (!c) return;
    c.parts.push(e.data); c.got += e.data.byteLength;
    this.ui.progress(c.row, c.got);
  }
}
