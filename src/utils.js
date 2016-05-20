/**
 * Polygon function
 */
export function polygon(d) {
  return 'M' + d.join('L') + 'Z'
}