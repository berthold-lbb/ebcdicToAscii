// file-name.util.ts
export function getFilenameFromContentDisposition(
  contentDisposition?: string | null
): string | null {
  if (!contentDisposition) {
    return null;
  }

  const parts = contentDisposition.split(';');

  for (const part of parts) {
    const trimmed = part.trim();

    if (trimmed.startsWith('filename=')) {
      const value = trimmed.substring('filename='.length).trim();

      // enlève guillemets si présents
      const filename =
        value.startsWith('"') && value.endsWith('"')
          ? value.slice(1, -1)
          : value;

      return filename || null;
    }
  }

  return null;
}



// file-name.util.spec.ts
import { getFilenameFromContentDisposition } from './file-name.util';

describe('getFilenameFromContentDisposition', () => {
  it('retourne null si header est null ou undefined', () => {
    expect(getFilenameFromContentDisposition(null)).toBeNull();
    expect(getFilenameFromContentDisposition(undefined)).toBeNull();
  });

  it('extrait un filename simple sans guillemets', () => {
    const cd = 'attachment; filename=rapport.zip';
    expect(getFilenameFromContentDisposition(cd)).toBe('rapport.zip');
  });

  it('extrait un filename avec guillemets', () => {
    const cd = 'attachment; filename="rapport final.zip"';
    expect(getFilenameFromContentDisposition(cd)).toBe('rapport final.zip');
  });

  it('ignore les autres paramètres', () => {
    const cd =
      'attachment; charset=utf-8; filename=2023-07-31_11-2X-06_et_27-20-01.zip';
    expect(getFilenameFromContentDisposition(cd))
      .toBe('2023-07-31_11-2X-06_et_27-20-01.zip');
  });

  it('retourne null si filename est absent', () => {
    const cd = 'attachment; charset=utf-8';
    expect(getFilenameFromContentDisposition(cd)).toBeNull();
  });

  it('retourne null si filename est vide', () => {
    const cd = 'attachment; filename=';
    expect(getFilenameFromContentDisposition(cd)).toBeNull();
  });
});
