import d3 from 'd3'
import { EVENTS } from './Events'

/**
 * Default config
 */
const defaults = {
  width: 400,
  height: 350,
  margin: {top: 20, right: 20, bottom: 40, left: 40},
  xVariable: 'x',
  yVariable: 'y',
  groupVariable: 'group',
  variables: {
    x: { name: 'X', accessor: d => d.x },
    y: { name: 'Y', accessor: d => d.y },
    group: { name: 'Group', accessor: d => d.group }
  },
  colors: d3.scale.category20().range().slice(10)
}

/**
 * Scatter chart class
 */
export class ScatterChart {

  constructor(options = {}, data = []){
    this.options = {}
    this.dispatch = d3.dispatch(EVENTS.POINT.DRAG)

    this.setOptions(options)
    this.setData(data)

    this.init()
  }

  setOptions(_){
    // Set width and height
    const elem = d3.select(_.target).node()

    // set width
    if (!_.width) {
      _.width = elem.clientWidth
    }

    // set height
    if (!_.height) {
      _.height = elem.clientHeight
    }

    // merge options
    Object.assign(this.options, defaults, _)

    // calculate width and height without margins
    const { width, height, margin } = this.options
    this.options.w = width - margin.left - margin.right
    this.options.h = height - margin.top - margin.bottom

    return this
  }

  setData(_){
    this.data = _
    return this
  }

  calculateLimits(){
    let { options: _, data} = this
    const { variables, xVariable, yVariable } = _

    _.xMax = d3.max(data, variables[xVariable].accessor)
    _.xMin = d3.min(data, variables[xVariable].accessor)
    _.yMax = d3.max(data, variables[yVariable].accessor)
    _.yMin = d3.min(data, variables[yVariable].accessor)
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
      variables,
      xVariable,
      yVariable,
      groupVariable,
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
      .style('width',  width + 'px')
      .style('height', height + 'px')

    this.g = this.svg.append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`)

    // g zoom layer
    this.g.append('rect')
      .attr('class', 'zoom-layer')
      .attr('width', w)
      .attr('height', h)
      .call(this.zoom)

    // X Axis
    // x axis layer
    this.g.append('rect')
      .attr('class', 'zoom-layer')
      .attr('transform', `translate(0, ${h})`)
      .attr('width', w)
      .attr('height', 20)
      .on('mousedown.drag',  this.xAxisDrag.bind(this))
      .on('touchstart.drag', this.xAxisDrag.bind(this))
      .on('mouseout',  this.mouseup.bind(this))

    this.xAxisG = this.g.append('g')
      .attr('class', 'x axis')
      .attr('transform', `translate(0, ${h})`)

    // Y Axis
    // y axis layer
    this.g.append('rect')
      .attr('class', 'zoom-layer ')
      .attr('transform', `translate(-30,0)`)
      .attr('height', h)
      .attr('width', 30)
      .on('mousedown.drag',  this.yAxisDrag.bind(this))
      .on('touchstart.drag', this.yAxisDrag.bind(this))
      .on('mouseout',  this.mouseup.bind(this))

    this.yAxisG = this.g.append('g')
      .attr('class', 'y axis')

    // Clip Path
    this.g.append('clipPath')
      .attr('id', 'clip')
      .append('rect')
      .attr('width', w)
      .attr('height', h)
      .attr('pointer-events', 'all')

    // Dots
    this.dots = this.g.append('g')
      .attr('class', 'dots')
      .attr('clip-path', 'url(#clip)')

    this.dots.selectAll('.dot')
      .data(data)
      .enter()
      .append('circle')
      .attr('class', 'dot')
      .classed('selected', d => d === self.selected )
      .attr('cx', d => self.x(variables[xVariable].accessor(d)))
      .attr('cy', d => self.y(variables[yVariable].accessor(d)))
      .attr('r', 5.0)
      .style('stroke', (d, i) => colors[variables[groupVariable].accessor(d, i)])
      .style('fill', (d, i) => colors[variables[groupVariable].accessor(d, i)])
      .style('cursor', 'move')
      .on('click',  this.pointClick)
      .on('mousedown.drag',  this.pointDrag())
      .on('touchstart.drag', this.pointDrag())

    // Reset button
    d3.select(target)
      .style('position', 'relative')

    d3.select(target).append('button')
      .attr('class', 'divis reset')
      .text('Reset')
      .on('click', this.reset.bind(this))

    // Events
    d3.select(target)
      .on('click', this.chartClick.bind(this))

    this.g
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
    const { dots, x, y, selected } = this
    const { variables, xVariable, yVariable } = this.options

    dots.selectAll('.dot')
      .classed('selected', d => d === selected )
      .attr('cx', d => x(variables[xVariable].accessor(d)))
      .attr('cy', d => y(variables[yVariable].accessor(d)))

    if (d3.event && d3.event.keyCode) {
      d3.event.preventDefault()
      d3.event.stopPropagation()
    }
  }

  chartClick() {
    this.selected = this.dragged = null
    this.update()
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

  pointClick(){
    d3.event.preventDefault()
    d3.event.stopPropagation()
  }

  mousemove() {
    const { xVariable, yVariable } = this.options
    const self = this, p = d3.mouse(self.g[0][0])

    if (self.dragged) {
      //TODO: need the right way (via accessors) to save values to dragged
      self.dragged[xVariable] = self.x.invert(Math.max(0, Math.min(self.options.w, p[0])))
      self.dragged[yVariable] = self.y.invert(Math.max(0, Math.min(self.options.h, p[1])))
      self.dispatch[EVENTS.POINT.DRAG](self.dragged, self.pointIndex)
      self.update()
    }
    if (!isNaN(self.xDrag)) {
      self.g.style("cursor", "ew-resize")

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
      self.g.style("cursor", "ns-resize")

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

    self.g.style("cursor", "auto")

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
      self.dispatch[EVENTS.POINT.DRAG](self.dragged, self.pointIndex)
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
    const p = d3.mouse(self.g[0][0])
    self.xDrag = self.x.invert(p[0])
  }

  yAxisDrag() {
    const self = this
    const p = d3.mouse(self.g[0][0])
    self.yDrag = self.y.invert(p[1])
  }

  reset(){
    const self = this

    // recalculate limits
    self.calculateLimits()

    d3.transition().duration(750)
      .tween("zoom", _ => {
        const ix = d3.interpolate(self.x.domain(), [self.options.xMin, self.options.xMax])
        const iy = d3.interpolate(self.y.domain(), [self.options.yMin, self.options.yMax])

        return t => {
          self.x.domain(ix(t))
          self.y.domain(iy(t))
          self.redraw()
        }
      })
  }
}