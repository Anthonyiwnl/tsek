/** Keep local dates readable without second-level precision. */
export function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}
