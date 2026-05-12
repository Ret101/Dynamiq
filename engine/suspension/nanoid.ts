// Minimal nanoid-compatible ID generator (no dependency required)
const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export function nanoid(size = 12): string {
  let id = '';
  const bytes = typeof crypto !== 'undefined'
    ? crypto.getRandomValues(new Uint8Array(size))
    : new Uint8Array(size).map(() => Math.floor(Math.random() * 256));
  for (let i = 0; i < size; i++) {
    id += chars[bytes[i] % chars.length];
  }
  return id;
}
