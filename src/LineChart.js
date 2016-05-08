import d3 from 'd3'

/**
 * Chart events
 */
export const EVENTS = {
  POINT: {
    DRAG: 'POINT_DRAG'
  }
}

/**
 * Default config
 */
const defaults = {
  width: 500,
  height: 350,
  margin: {top: 20, right: 0, bottom: 40, left: 40},
  xAccessor: d => d.x,
  yAccessor: d => d.y,
  colors: d3.scale.category20().range().slice(10),
  get w() {
    const { width, margin } = this
    return width - margin.left - margin.right
  },
  get h() {
    const { height, margin } = this
    return height - margin.top - margin.bottom
  }
}

/**
 * Line chart class
 */
export class LineChart {

  constructor(options = {}, data = []){
    this.options = {}
    this.dispatch = d3.dispatch(EVENTS.POINT.DRAG)

    this.setOptions(options)
    this.setData(data)

    this.init()
  }

  setOptions(_){
    Object.assign(this.options, defaults, _)
    return this
  }

  setData(_){
    this.data = _
    return this
  }

  calculateLimits(){
    let { options: _} = this
    const { xAccessor, yAccessor } = _

    _.xMax = -Infinity
    _.xMin = Infinity
    _.yMax = -Infinity
    _.yMin = Infinity

    this.data.forEach(d => {
      _.xMax = d3.max([_.xMax, d3.max(d, xAccessor)])
      _.xMin = d3.min([_.xMin, d3.min(d, xAccessor)])
      _.yMax = d3.max([_.yMax, d3.max(d, yAccessor)])
      _.yMin = d3.min([_.yMin, d3.min(d, yAccessor)])
    })
  }

  init(){
    let self = this
    const { options, data } = this

    // calculate domain limits for x and y axes
    this.calculateLimits()

    const { 
      target, 
      width, 
      height, 
      margin, 
      w, 
      h, 
      xMax, 
      xMin,
      yMax,
      yMin,
      xAccessor, 
      yAccessor,
      colors
      } = options

    // x-scale
    this.x = d3.scale.linear()
      .domain([xMin, xMax])
      .range([0, w])

    // y-scale (inverted domain)
    this.y = d3.scale.linear()
      .domain([yMin, yMax])
      .nice()
      .range([h, 0])
      .nice()

    // axes
    this.xAxis = d3.svg.axis()
      .scale(this.x)
      .orient('bottom')
      .tickSize(-h)
      .tickPadding(10)

    this.yAxis = d3.svg.axis()
      .scale(this.y)
      .orient('left')
      .tickSize(-w)
      .tickPadding(10)

    this.line = d3.svg.line()
      .x(d => self.x(xAccessor(d)))
      .y(d => self.y(yAccessor(d)))

    this.zoom = d3.behavior.zoom()
      .x(this.x)
      .y(this.y)
      .on('zoom', this.zoomed.bind(this))

    // drag x-axis
    this.xDrag = Math.NaN

    // drag y-axis
    this.yDrag = Math.NaN

    // define dragged and selected point
    this.dragged = this.selected = null


    // SVG
    this.svg = d3.select(target).append('svg')
      .attr('class', 'divis')
      .attr('width',  width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`)

    // svg zoom layer
    this.svg.append('rect')
      .attr('class', 'zoom-layer')
      .attr('width', w)
      .attr('height', h)
      .call(this.zoom)

    // X Axis
    // x axis layer
    this.svg.append('rect')
      .attr('class', 'zoom-layer')
      .attr('transform', `translate(0, ${h})`)
      .attr('width', w)
      .attr('height', 20)
      .on('mousedown.drag',  this.xAxisDrag.bind(this))
      .on('touchstart.drag', this.xAxisDrag.bind(this))
      .on('mouseout',  this.mouseup.bind(this))

    this.xAxisG = this.svg.append('g')
      .attr('class', 'x axis')
      .attr('transform', `translate(0, ${h})`)

    // Y Axis
    // y axis layer
    this.svg.append('rect')
      .attr('class', 'zoom-layer ')
      .attr('transform', `translate(-30,0)`)
      .attr('height', h)
      .attr('width', 30)
      .on('mousedown.drag',  this.yAxisDrag.bind(this))
      .on('touchstart.drag', this.yAxisDrag.bind(this))
      .on('mouseout',  this.mouseup.bind(this))

    this.yAxisG = this.svg.append('g')
      .attr('class', 'y axis')

    // Clip Path
    this.svg.append('clipPath')
      .attr('id', 'clip')
      .append('rect')
      .attr('width', w)
      .attr('height', h)
      .attr('pointer-events', 'all')

    // Lines Plot
    this.lines = this.svg.selectAll('.line')
      .data(data)

    this.lines.enter()
      .append('path')
      .attr('class', 'line')
      .attr('clip-path', 'url(#clip)')
      .attr('d', this.line)
      .style('stroke', (d, i) => colors[i % colors.length])

    this.lines.exit().remove()

    // Dots
    this.dots = this.svg.selectAll('.dots')
      .data(data)

    this.dots.enter()
      .append('g')
      .attr('class', 'dots')
      .attr('clip-path', 'url(#clip)')

    this.dots.selectAll('.dot')
      .data(d => d)
      .enter()
      .append('circle')
      .attr('class', 'dot')
      .classed('selected', d => d === self.selected )
      .attr('cx', d => self.x(xAccessor(d)))
      .attr('cy', d => self.y(yAccessor(d)))
      .attr('r', 5.0)
      .style('stroke', (d, i, s) => colors[s])
      .style('fill', (d, i, s) => colors[s])
      .style('cursor', 'ns-resize')
      .on('click',  this.pointClick)
      .on('mousedown.drag',  this.pointDrag())
      .on('touchstart.drag', this.pointDrag())

    this.dots.exit().remove()

    d3.select(target)
      .on('click', this.chartClick.bind(this))

    this.svg
      .on('mousemove.drag', this.mousemove.bind(this))
      .on('touchmove.drag', this.mousemove.bind(this))
      .on('mouseup.drag',   this.mouseup.bind(this))
      .on('touchend.drag',  this.mouseup.bind(this))
  }

  render(){
    this.redraw()
  }

  redraw() {
    const self = this
    self.xAxisG.call(self.xAxis)
    self.yAxisG.call(self.yAxis)
    self.zoom.x(self.x).y(self.y)
    self.update()
  }

  update() {
    const { line, lines, dots, x, y, selected } = this

    lines.attr('d', line)

    dots.selectAll('.dot')
      .classed('selected', d => d === selected )
      .attr('cx', d => x(d.x))
      .attr('cy', d => y(d.y))

    if (d3.event && d3.event.keyCode) {
      d3.event.preventDefault()
      d3.event.stopPropagation()
    }
  }

  pointDrag() {
    const self = this
    return function(d, i) {
      if (d3.event) {
        d3.event.preventDefault()
        d3.event.stopPropagation()
      }

      self.selected = self.dragged = d
      self.pointIndex = i
      self.update()
    }
  }

  chartClick() {
    this.selected = this.dragged = null
    this.update()
  }

  pointClick(){
    d3.event.preventDefault()
    d3.event.stopPropagation()
  }

  mousemove() {
    const self = this, p = d3.mouse(self.svg[0][0])

    if (self.dragged) {
      self.dragged.y = self.y.invert(Math.max(0, Math.min(self.options.h, p[1])))
      self.dispatch[EVENTS.POINT.DRAG](self.pointIndex, self.dragged)
      self.update()
    }
    if (!isNaN(self.xDrag)) {
      self.svg.style("cursor", "ew-resize")

      const x = self.x.invert(p[0]),
        x0 = self.x.domain()[0],
        x1 = self.x.domain()[1],
        range = x1 - x0

      if ((x - x0) != 0) {
        const dx = (self.xDrag - x0) / (x - x0)
        const domain = [x0, x0 + (range * dx)]
        self.x.domain(domain)
        self.redraw()
      }

      d3.event.preventDefault()
      d3.event.stopPropagation()
    }
    if (!isNaN(self.yDrag)) {
      self.svg.style("cursor", "ns-resize")

      const y = self.y.invert(p[1]),
        y0 = self.y.domain()[0],
        y1 = self.y.domain()[1],
        range = y1 - y0

      if ((y - y0) != 0) {
        const dy = (self.yDrag - y0) / (y - y0)
        const domain = [y0, y0 + (range * dy)]
        self.y.domain(domain)
        self.redraw()
      }

      d3.event.preventDefault()
      d3.event.stopPropagation()
    }
  }

  mouseup() {
    const self = this

    self.svg.style("cursor", "auto")

    if (!isNaN(self.xDrag)) {
      self.redraw()
      self.xDrag = Math.NaN
      d3.event.preventDefault()
      d3.event.stopPropagation()
    }
    if (!isNaN(self.yDrag)) {
      self.redraw()
      self.yDrag = Math.NaN
      d3.event.preventDefault()
      d3.event.stopPropagation()
    }
    if (self.dragged) {
      self.dispatch[EVENTS.POINT.DRAG](self.pointIndex, self.dragged)
      self.dragged = null
    }
  }

  zoomed() {
    const self = this
    self.xAxisG.call(self.xAxis)
    self.yAxisG.call(self.yAxis)
    self.update()
  }

  xAxisDrag() {
    const self = this
    const p = d3.mouse(self.svg[0][0])
    self.xDrag = self.x.invert(p[0])
  }

  yAxisDrag() {
    const self = this
    const p = d3.mouse(self.svg[0][0])
    self.yDrag = self.y.invert(p[1])
  }

}