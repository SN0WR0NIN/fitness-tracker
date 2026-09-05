const signatures = {
  'image/jpeg': (buffer: Buffer) => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
  'image/png': (buffer: Buffer) => buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/webp': (buffer: Buffer) => buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP',
  'image/gif': (buffer: Buffer) => buffer.length >= 6 && ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii')),
} as const;

export type SupportedImageMime = keyof typeof signatures;

export function verifiedImageMime(buffer: Buffer, declaredType: string, allowed: readonly SupportedImageMime[]): SupportedImageMime | null {
  if (!allowed.includes(declaredType as SupportedImageMime)) return null;
  const verifier = signatures[declaredType as SupportedImageMime];
  return verifier?.(buffer) ? declaredType as SupportedImageMime : null;
}

export function imageExtension(contentType: SupportedImageMime): string {
  if (contentType === 'image/jpeg') return 'jpg';
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  if (contentType === 'image/gif') return 'gif';
  return 'img';
}
