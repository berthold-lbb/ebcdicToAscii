static toBlob(base64: string, contentType = 'application/octet-stream'): Blob {
  const pure = base64.includes(',') ? base64.split(',').pop()! : base64;

  const byteChars = atob(pure);
  const sliceSize = 1024;

  const chunks: ArrayBuffer[] = [];

  for (let offset = 0; offset < byteChars.length; offset += sliceSize) {
    const slice = byteChars.slice(offset, offset + sliceSize);

    const bytes = new Uint8Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      bytes[i] = slice.charCodeAt(i);
    }

    // ✅ on push le buffer (ArrayBuffer) => BlobPart compatible
    chunks.push(bytes.buffer);
  }

  return new Blob(chunks, { type: contentType });
}
