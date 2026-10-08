// QR support: draw a code as a QR image, or scan one with the camera. Libraries load only when needed.
let gen, jsQR;

export async function drawQr(canvas, text) {
  gen ??= (await import('./qrgen.js')).default;
  const q = gen(0, 'L'); q.addData(text); q.make();
  const n = q.getModuleCount(), cell = 6, pad = 4, size = (n + pad * 2) * cell;
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, size, size); g.fillStyle = '#000'; // always dark-on-light so scanners can read it
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) g.fillRect((c + pad) * cell, (r + pad) * cell, cell, cell);
}

// Starts the camera in <video>, calls onText with the first QR found, returns a stop() function.
export async function scanQr(video, onText, onError) {
  jsQR ??= (await import('./qrscan.js')).default;
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); }
  catch (e) { onError(e); return () => {}; }
  video.srcObject = stream;
  try { await video.play(); } catch {}
  const cv = document.createElement('canvas'), g = cv.getContext('2d', { willReadFrequently: true });
  let live = true;
  const stop = () => { live = false; stream.getTracks().forEach(t => t.stop()); video.srcObject = null; };
  const tick = () => {
    if (!live) return;
    if (video.readyState >= 2 && video.videoWidth) {
      const k = Math.min(1, 640 / video.videoWidth);
      cv.width = Math.round(video.videoWidth * k); cv.height = Math.round(video.videoHeight * k);
      g.drawImage(video, 0, 0, cv.width, cv.height);
      const img = g.getImageData(0, 0, cv.width, cv.height);
      const res = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
      if (res && res.data) { stop(); onText(res.data); return; }
    }
    requestAnimationFrame(tick);
  };
  tick();
  return stop;
}
