/**
 * Polygon function
 */
export function polygon(d) {
  if (!d.length) return;
  return 'M' + d.join('L') + 'Z'
}

/**
 * Find the nodes within the specified rectangle.
 */
export function quadTreeSearch(quadtree, extent, xAccessor, yAccessor) {
  const
    x0 = extent[0][0],
    y0 = extent[0][1],
    x3 = extent[1][0],
    y3 = extent[1][1]

  quadtree.visit(function(node, x1, y1, x2, y2) {
    let p = node.point

    if (p) {
      p.selected = (xAccessor(p) >= x0) && (xAccessor(p) <= x3) && (yAccessor(p) >= y0) && (yAccessor(p) <= y3)
    }

    return x1 > x3 || y1 > y3 || x2 < x0 || y2 < y0
  })
}

/**
 * Define data to be available for charts
 */
export function isDefined(d) {
  return d !== null && d !== undefined && d !== 'NaN' && d !== NaN
}