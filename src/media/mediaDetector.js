const SIGNATURES = {
  isImage: buf => SIGNATURES.isJPEG(buf) || SIGNATURES.isPNG(buf) || SIGNATURES.isGIF(buf) || SIGNATURES.isBMP(buf),
  isJPEG: buf => buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF,
  isPNG: buf => buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47,
  isGIF: buf => buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46,
  isBMP: buf => buf[0] === 0x42 && buf[1] === 0x4D,
  isVideo: buf => SIGNATURES.isMP4(buf) || SIGNATURES.isWebM(buf) || SIGNATURES.isFLV(buf),
  isMP4: buf => buf.length >= 8 && buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70,
  isWebM: buf => buf[0] === 0x1A && buf[1] === 0x45 && buf[2] === 0xDF && buf[3] === 0xA3,
  isFLV: buf => buf[0] === 0x46 && buf[1] === 0x4C && buf[2] === 0x56
};

export async function detectFileType(file) {
  const blob = file.slice(0, 12);
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  return SIGNATURES.isImage(bytes) ? "image" : SIGNATURES.isVideo(bytes) ? "video" : "unknown";
}
