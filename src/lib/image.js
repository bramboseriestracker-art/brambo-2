/* Turns any image the user picks, whatever its size or format, into a JPEG that fits the server limit.
   The browser does the work: it decodes the file, crops to the target shape and lowers quality/size until it is small enough. */
const LIMIT = 1.4 * 1024 * 1024; // bytes, safely under Vercel's 4.5 MB request cap once base64-encoded

async function decode(file) {
  if ('createImageBitmap' in window) {
    try { return await createImageBitmap(file); } catch { /* fall through to <img> */ }
  }
  return new Promise((res, rej) => {
    const i = new Image(); const url = URL.createObjectURL(file);
    i.onload = () => { URL.revokeObjectURL(url); res(i); };
    i.onerror = () => rej(new Error('That file is not an image this browser can read.'));
    i.src = url;
  });
}

const bytesOf = (dataUrl) => Math.floor((dataUrl.length - dataUrl.indexOf(',') - 1) * 0.75);

export async function prepareImage(file, w, h) {
  if (!file) throw new Error('No file selected.');
  const src = await decode(file);
  const sw = src.width, sh = src.height;
  if (!sw || !sh) throw new Error('That image is empty.');
  let scale = 1, quality = 0.9;
  for (let attempt = 0; attempt < 12; attempt++) {
    const cw = Math.max(64, Math.round(w * scale)), ch = Math.max(64, Math.round(h * scale));
    const canvas = document.createElement('canvas'); canvas.width = cw; canvas.height = ch;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, cw, ch); // transparent PNGs get a white background
    const k = Math.max(cw / sw, ch / sh);                  // cover and centre-crop
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, (cw - sw * k) / 2, (ch - sh * k) / 2, sw * k, sh * k);
    const out = canvas.toDataURL('image/jpeg', quality);
    if (bytesOf(out) <= LIMIT) return out;
    if (quality > 0.55) quality -= 0.12; else scale *= 0.8;
  }
  throw new Error('Could not compress that image enough. Try a different one.');
}
