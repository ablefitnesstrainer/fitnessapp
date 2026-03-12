const ALLOWED_SIGNATURES: Record<string, number[][]> = {
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/png": [[0x89, 0x50, 0x4e, 0x47]],
  "image/webp": [[0x52, 0x49, 0x46, 0x46]], // RIFF....WEBP (checked with extra rule)
  "application/pdf": [[0x25, 0x50, 0x44, 0x46]], // %PDF
  "text/plain": [] // text files are allowed without strict magic signature
};

export function sanitizeFilename(name: string, fallback = "upload") {
  const cleaned = (name || "")
    .replace(/[^a-zA-Z0-9._ -]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return cleaned || fallback;
}

function startsWithSignature(buffer: Buffer, signature: number[]) {
  if (buffer.length < signature.length) return false;
  return signature.every((byte, idx) => buffer[idx] === byte);
}

function isLikelyUtf8Text(buffer: Buffer) {
  // Lightweight check: reject buffers with too many null bytes.
  let nullCount = 0;
  const sample = Math.min(buffer.length, 4096);
  for (let i = 0; i < sample; i += 1) {
    if (buffer[i] === 0x00) nullCount += 1;
  }
  return nullCount <= 2;
}

export function validateUploadedBuffer(fileType: string, buffer: Buffer) {
  const signatures = ALLOWED_SIGNATURES[fileType];
  if (!signatures) return { ok: false, reason: "Unsupported file type" };

  if (fileType === "text/plain") {
    if (!isLikelyUtf8Text(buffer)) return { ok: false, reason: "Uploaded file content does not match text/plain" };
    return { ok: true };
  }

  const hasMagic = signatures.some((signature) => startsWithSignature(buffer, signature));
  if (!hasMagic) return { ok: false, reason: `Uploaded file content does not match ${fileType}` };

  if (fileType === "image/webp") {
    const header = buffer.slice(0, 16).toString("ascii");
    if (!header.includes("WEBP")) {
      return { ok: false, reason: "Uploaded file content does not match image/webp" };
    }
  }

  return { ok: true };
}
