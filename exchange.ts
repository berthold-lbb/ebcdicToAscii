static toBlob(base64: string, contentType = 'application/octet-stream'): Blob {
  // si tu reçois "data:application/zip;base64,AAAA..."
  const pure = base64.includes(',') ? base64.split(',').pop()! : base64;

  const byteChars = atob(pure);
  const sliceSize = 1024;

  const chunks: Uint8Array[] = [];

  for (let offset = 0; offset < byteChars.length; offset += sliceSize) {
    const slice = byteChars.slice(offset, offset + sliceSize);

    const bytes = new Uint8Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      bytes[i] = slice.charCodeAt(i);
    }

    chunks.push(bytes);
  }

  return new Blob(chunks, { type: contentType });
}
