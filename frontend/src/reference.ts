/** Format an application UUID for display without changing its API identity. */
export function toReference(id: string): string {
  return `TSK-${id.replaceAll('-', '').slice(0, 6).toUpperCase()}`;
}
