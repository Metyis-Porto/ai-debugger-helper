/** Decodes a `data:` URL (as produced by `captureScreenshot`) into a real binary Blob. */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mimeMatch = /data:([^;]+);base64/.exec(header ?? '');
  const mime = mimeMatch?.[1] ?? 'application/octet-stream';
  const binary = atob(base64 ?? '');
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1)
    bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mime });
}
