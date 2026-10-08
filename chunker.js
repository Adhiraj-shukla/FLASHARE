// Splits files into chunks and applies backpressure against the data channel buffer.
export const CHUNK = 16384;          // safe cross-browser message size
export const HIGH = 4 * 1024 * 1024; // pause sending above this buffered amount
export const LOW = 1024 * 1024;      // resume below this (bufferedAmountLowThreshold)

export async function* readChunks(file) {
  for (let o = 0; o < file.size; o += CHUNK) yield await file.slice(o, o + CHUNK).arrayBuffer();
}

export async function waitForDrain(dc) {
  if (dc.bufferedAmount > HIGH)
    await new Promise(r => dc.addEventListener('bufferedamountlow', r, { once: true }));
}
