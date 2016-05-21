/**
 * Polygon function
 */
export function polygon(d) {
  if (!d.length) return;
  return 'M' + d.join('L') + 'Z'
}