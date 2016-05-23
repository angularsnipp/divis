import d3 from 'd3'
import { EVENTS } from './Events'

/**
 * Default config
 */
const defaults = {
  margin: {top: 23, right: 20, bottom: 40, left: 40},
  xVariable: 'x',
  yVariables: ['y'],
  variables: {
    x: { name: 'X', accessor: d => d.x },
    y: { name: 'Y', accessor: d => d.y }
  },
  colors: d3.scale.category20().range().slice(10),
  useEdit: true,
  useZoom: true,
  usePanel: true,
  panel: [
    { type: 'checkbox', text: 'Edit', visible: true, option: 'useEdit' },
    { type: 'checkbox', text: 'Zoom', visible: true, option: 'useZoom' },
    { type: 'button', text: 'Reset', visible: true, callback: chart => chart.reset() }
  ],
  legend: {
    align: 'left',
    x: 0,
    y: 0,
    itemHeight: 12,
    itemWidth: 50,
    gap: 5,
    isHorizontal: true
  }
}

/**
 * Line chart class
 */
export class LineChart {

  constructor(options = {}, data = []){
    this.options = {}
    this.dispatch = d3.dispatch(EVENTS.POINT.DRAG, EVENTS.POINT.CLICK)

    this.setOptions(options)
    this.setData(data)

    // define chart id
    this.options.id = Math.random().toString(36).substr(2, 15)

    // calculate width, height, w, h
    this.calculateSize()

    // calculate domain limits for x and y axes
    this.calculateLimits()

    // init global events
    this.initGlobalEvents()
  }

  setOptions(_){
    // save initial options
    this._options = _

    Object.assign(this.options, defaults, _)

    return this
  }

  setData(_){
    this.data = _
    return this
  }

  // Set width and height
  calculateSize(){
    const { width: staticWidth, height: staticHeight } = this._options
    let { options } = this

    const elem = d3.select(options.target).node()

    // set width
    options.width = staticWidth || elem.clientWidth || 400

    // set height
    options.height = staticHeight || elem.clientHeight || 350

    // calculate width and height without margins
    const { width, height, margin } = options
    options.w = width - margin.left - margin.right
    options.h = height - margin.top - margin.bottom
  }

  calculateLimits(){
    let { options } = this
    const { data } = this
    const { variables, xVariable, yVariables } = options

    options.xMax = d3.max(data, variables[xVariable].accessor)
    options.xMin = d3.min(data, variables[xVariable].accessor)
    options.yMax = d3.max(data, (d, i) => d3.max(yVariables, v => variables[v].accessor(d, i)))
    options.yMin = d3.min(data, (d, i) => d3.min(yVariables, v => variables[v].accessor(d, i)))
  }

  init(){
    let self = this
    const { options, data } = this

    const {
      id,
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
      yVariables,
      colors,
      legend,
      useEdit,
      useZoom,
      usePanel,
      panel
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
      .x((d, i) => self.x(variables[xVariable].accessor(d, i)))

    this.zoom = d3.behavior.zoom()
      .x(this.x)
      .y(this.y)
      .on('zoom', this.zoomed.bind(this))

    this.xAxisZoom = d3.behavior.zoom()
      .x(this.x)
      .on('zoom', this.zoomed.bind(this))

    this.yAxisZoom = d3.behavior.zoom()
      .y(this.y)
      .on('zoom', this.zoomed.bind(this))

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
    this.zoomLayer = this.g.append('rect')
      .attr('class', 'zoom-layer')
      .attr('width', w)
      .attr('height', h)

    // X Axis
    // x axis layer
    this.xAxisZoomLayer = this.g.append('rect')
      .attr('class', 'zoom-layer')
      .attr('transform', `translate(0, ${h})`)
      .attr('width', w)
      .attr('height', 20)

    this.xAxisG = this.g.append('g')
      .attr('class', 'x axis')
      .attr('transform', `translate(0, ${h})`)

    // Y Axis
    // y axis layer
    this.yAxisZoomLayer = this.g.append('rect')
      .attr('class', 'zoom-layer ')
      .attr('transform', `translate(-30,0)`)
      .attr('height', h)
      .attr('width', 30)

    this.yAxisG = this.g.append('g')
      .attr('class', 'y axis')

    // Call Zoom Layer
    if (useZoom) this.callZoomLayer()

    // Clip Path
    this.g.append('clipPath')
      .attr('id', 'clip')
      .append('rect')
      .attr('width', w)
      .attr('height', h)
      .attr('pointer-events', 'all')

    // Lines Plot
    this.lines = this.g.selectAll('.line')
      .data(yVariables)

    this.lines.enter()
      .append('path')
      .attr('class', 'line')
      .attr('clip-path', 'url(#clip)')
      .attr('d', v => {
        return self.line.y((d, i) => self.y(variables[v].accessor(d, i)))(data)
      })
      .style('stroke', (v, i) => variables[v].color || colors[i])

    this.lines.exit().remove()

    // Dots
    this.dots = this.g.selectAll('.dots')
      .data(yVariables)

    this.dots.enter()
      .append('g')
      .attr('class', 'dots')
      .attr('clip-path', 'url(#clip)')

    let dot = this.dots.selectAll('.dot')
      .data(d => data)
      .enter()
      .append('circle')
      .attr('class', 'dot')

    dot
      .classed('selected', d => d === self.selected )
      .attr('cx', (d, i, s) => self.x(variables[xVariable].accessor(d, i)))
      .attr('cy', (d, i ,s) => self.y(variables[yVariables[s]].accessor(d, i)))
      .attr('r', 5.0)
      .style('stroke', (d, i, s) => variables[yVariables[s]].color || colors[s])
      .style('fill', (d, i, s) => variables[yVariables[s]].color || colors[s])

    if (useEdit) {
      dot.
        style('cursor', 'pointer')
        .on('click', this.pointClick.bind(this))
        .on('mousedown.drag', this.pointDrag.bind(this))
        .on('touchstart.drag', this.pointDrag.bind(this))
    }

    this.dots.exit().remove()

    // Legend
    // TODO: now translate is for horizontal legend
    this.legend = this.svg.append('g')
      .attr('class', 'legend')
      .attr('transform', `translate(${ legend.align === 'left' ? width - margin.right - legend.x - yVariables.length * legend.itemWidth : margin.left + legend.x }, ${legend.y})`);

    const items = this.legend.selectAll('legend-item')
      .data(yVariables)

    const item = items.enter()
      .append('g')
      .attr('class', 'legend-item')
      .attr('transform', (v, i) => legend.isHorizontal
        ? `translate(${i * legend.itemWidth}, 0)`
        : `translate(0, ${i * legend.itemHeight})`
      )

    item
      .append('rect')
      .attr('width', legend.itemHeight)
      .attr('height', legend.itemHeight)
      .attr('fill', (v, i) => variables[v].color || colors[i])

    item.append('text')
      .text(v => variables[v].name)
      .attr('x', legend.itemHeight + legend.gap)
      .attr('y', v => legend.itemHeight - 1)

    items.exit().remove()

    // Reset button
    d3.select(target)
      .style('position', 'relative')

    d3.select(target).append('button')
      .attr('class', 'divis reset')
      .text('Reset')
      .on('click', this.reset.bind(this))

    // Panel
    if (usePanel) {
      this.panel = d3.select(target).append('div')
        .attr('class', 'divis panel')
        .selectAll('.panel-item')
        .data(panel.filter(d => d.visible))

      this.panelLabels = this.panel.enter()
        .append('div')
        .attr('class', 'panel-item')
        .append('label')

      this.panelLabels.append('input')
        .attr('type', d => d.type || 'checkbox')
        .attr('checked', d => {
          if (d.type == 'checkbox') return self.options[d.option] ? 'checked' : null
        })
        .attr('hidden', '')
        .on('click', function(d) {
          if (d.type == 'checkbox') {
            self.options[d.option] = !self.options[d.option]
            d3.select(this).attr('checked', self.options[d.option] ? 'checked' : null)

            // set current domain after render
            const xDomain = self.x.domain()
            const yDomain = self.y.domain()
            self.render()
            self.x.domain(xDomain)
            self.y.domain(yDomain)
            self.redraw()
          }
          // callback
          if (typeof d.callback === 'function') d.callback(self, this, d)
        })

      this.panelLabels.append('span')
        .text(d => d.text)

      this.panel.exit().remove()
    }

    // Events
    d3.select(target)
      .on('click', this.chartClick.bind(this))

    this.g
      .on('mousemove.drag', this.mousemove.bind(this))
      .on('touchmove.drag', this.mousemove.bind(this))
      .on('mouseup.drag',   this.mouseup.bind(this))
      .on('touchend.drag',  this.mouseup.bind(this))
  }

  initGlobalEvents(element = window){
    const self = this
    const { id } = this.options
    const keyCodes = [72, 86] // ['H', 'V']

    d3.select(element)
      .on('keydown.' + id, _ => {
        const { useZoom } = self.options
        const keyCode = d3.event.keyCode
        if (keyCodes.indexOf(keyCode) > -1 && self.keyPressed !== keyCode) {
          self.keyPressed = keyCode
          if (useZoom) self.updateZoom()
        }
      })
      .on('keyup.' + id, _ => {
        const { useZoom } = self.options
        if (keyCodes.indexOf(d3.event.keyCode) > -1) {
          self.keyPressed = null
          if (useZoom) self.updateZoom()
        }
      })
  }

  clearGlobalEvents(element = window){
    const self = this
    const { id } = this.options

    d3.select(element)
      .on('keydown.' + id, null)
      .on('keyup.' + id, null)
  }

  clear(){
    const { target } = this.options
    d3.select(target).selectAll('*').remove()
  }

  render(){
    this.clear()
    this.init()
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
    const { data, line, lines, dots, x, y, selected } = this
    const { variables, xVariable, yVariables } = this.options

    lines.attr('d', v => {
      return line.y((d, i) => y(variables[v].accessor(d, i)))(data)
    })

    dots.selectAll('.dot')
      .classed('selected', d => d === selected )
      .attr('cx', (d, i, s) => x(variables[xVariable].accessor(d, i)))
      .attr('cy', (d, i ,s) => y(variables[yVariables[s]].accessor(d, i)))

    if (d3.event && d3.event.keyCode) {
      d3.event.preventDefault()
      d3.event.stopPropagation()
    }
  }

  chartClick() {
    this.selected = this.dragged = null
    this.update()
  }

  pointDrag(d, i, s) {
    const self = this

    if (d3.event) {
      d3.event.preventDefault()
      d3.event.stopPropagation()
    }

    self.selected = self.dragged = d
    self.pointIndex = i
    self.seriesIndex = s
    self.update()
  }

  pointClick(d, i, s){
    this.dispatch[EVENTS.POINT.CLICK](d, i, s)
    d3.event.preventDefault()
    d3.event.stopPropagation()
  }

  mousemove() {
    const { yVariables } = this.options
    const self = this, p = d3.mouse(self.g[0][0])

    if (self.dragged) {
      //TODO: need the right way (via accessors) to save values to dragged
      self.dragged[yVariables[self.seriesIndex]] = self.y.invert(Math.max(0, Math.min(self.options.h, p[1])))
      self.dispatch[EVENTS.POINT.DRAG](self.dragged, self.pointIndex, self.seriesIndex)
      self.update()
    }
  }

  mouseup() {
    const self = this

    self.g.style("cursor", "auto")

    if (self.dragged) {
      self.dispatch[EVENTS.POINT.DRAG](self.dragged, self.pointIndex, self.seriesIndex)
      self.dragged = null
    }
  }

  zoomed() {
    const self = this

    // update zoom behaviour
    self.updateZoom()

    self.xAxisG.call(self.xAxis)
    self.yAxisG.call(self.yAxis)
    self.update()
  }

  updateZoom(){
    const self = this

    switch (self.keyPressed) {

      // H, horizontal zoom
      case 72:
        self.zoom = d3.behavior.zoom()
          .x(self.x)
          .on('zoom', self.zoomed.bind(self))
        break

      // V, vertical zoom
      case 86:
        self.zoom = d3.behavior.zoom()
          .y(self.y)
          .on('zoom', self.zoomed.bind(self))
        break

      default:
        self.zoom = d3.behavior.zoom()
          .x(self.x)
          .y(self.y)
          .on('zoom', self.zoomed.bind(self))
    }

    self.xAxisZoom = d3.behavior.zoom()
      .x(self.x)
      .on('zoom', self.zoomed.bind(self))

    self.yAxisZoom = d3.behavior.zoom()
      .y(self.y)
      .on('zoom', self.zoomed.bind(self))

    self.callZoomLayer()
  }

  callZoomLayer(){
    const self = this
    self.zoomLayer.call(self.zoom)
    self.xAxisZoomLayer.call(self.xAxisZoom)
    self.yAxisZoomLayer.call(self.yAxisZoom)
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

  resize(){
    this.calculateSize()
    this.calculateLimits()
    this.render()
  }
}