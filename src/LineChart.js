import d3 from 'd3'
import { EVENTS } from './Events'
import { ContextMenu } from './ContextMenu'
import { isDefined } from './utils'

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
  x: d3.scale.linear(),
  y: d3.scale.linear(),
  colors: d3.scale.category20().range().slice(10),
  useEdit: true,
  useZoom: true,
  useSelect: false,
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
  },
  contextMenu: {
    items: [
      {
        title: 'Clear Selection',
        action: function(chart, elm, d, i, s) {
          chart.clearSelection()
          chart.saveRender()
        }
      }
    ]
  }
}

/**
 * Line chart class
 */
export class LineChart {

  constructor(options = {}, data = []){
    this.options = {}
    this.dispatch = d3.dispatch(
      EVENTS.POINT.DRAG,
      EVENTS.POINT.CLICK,
      EVENTS.POINT.SELECT
    )

    // initialize array-like object of selected point indices
    this.selectedIndices = {}
    this.selectedIndicesExtra = {}

    // define options and data
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

    // init context menu
    this.contextMenu = new ContextMenu(this.options.contextMenu)
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
    const { options, data, selectedIndices } = this

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
      x,
      y,
      colors,
      legend,
      useEdit,
      useZoom,
      useSelect,
      usePanel,
      panel
      } = options

    // auxilliary params
    const defaultBrushExtent = [[0, 0], [0, 0]]

    // recalculate data with selections
    data.forEach(d => d.selected = [])
    for (let i in selectedIndices) data[i].selected = selectedIndices[i]

    // x-scale
    this.x = x
      .domain([xMin, xMax])
      .range([0, w])

    // y-scale (inverted domain)
    this.y = y
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

    // Brush
    this.brush = d3.svg.brush()
      .x(self.x)
      .y(self.y)
      .extent(defaultBrushExtent)
      .on('brush', this.brushed.bind(this))
      .on('brushend', this.brushended.bind(this))

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
        return self.line
          .defined((d, i) => isDefined(variables[v].accessor(d, i)))
          .y((d, i) => self.y(variables[v].accessor(d, i)))(data)
      })
      .style('stroke', (v, i) => variables[v].color || colors[i])

    this.lines.exit().remove()

    // define brush for dots
    this.brushG = this.g.append('g')
      .attr('class', 'brush')

    //
    // Dots
    //
    this.dots = this.g.selectAll('.dots')
      .data(yVariables)

    this.dots.enter()
      .append('g')
      .attr('class', 'dots')
      .attr('clip-path', 'url(#clip)')

    let dot = this.dots.selectAll('.dot')
      .data(v => data)
      .enter()
      .append('circle')
      .attr('class', 'dot')

    dot
      .classed('selected', (d, i, s) => d.selected && d.selected.indexOf(s) > -1)
      .attr('cx', (d, i, s) => self.x(variables[xVariable].accessor(d, i)))
      .attr('cy', (d, i ,s) => self.y(variables[yVariables[s]].accessor(d, i)))
      .attr('r', 5.0)
      .style('stroke', (d, i, s) => variables[yVariables[s]].color || colors[s])
      .style('fill', (d, i, s) => variables[yVariables[s]].color || colors[s])
      .style('display', (d, i, s) => !isDefined(variables[yVariables[s]].accessor(d, i)) ? 'none' : null)
      .style('cursor', 'pointer')
      .on('click', this.pointClick.bind(this))

    if (useEdit) {
      dot
        .on('mousedown.drag', this.pointDrag.bind(this))
        .on('touchstart.drag', this.pointDrag.bind(this))
    }

    // call brush if useSelect mode
    if (useSelect) {
      this.brushG
        .call(this.brush)
        .call(this.brush.event)
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

    // Set relative position for container
    d3.select(target).style('position', 'relative')

    // Panel
    if (usePanel) {
      const _panelContainer = d3.select(target).append('div')
        .attr('class', 'divis panel-container')

      // panel
      const _panel = _panelContainer.append('div')
        .attr('class', 'panel')
        .selectAll('.panel-item')
        .data(panel.filter(d => d.visible))

      const _panelLabels = _panel.enter()
        .append('div')
        .attr('class', 'panel-item')
        .append('label')

      _panelLabels.append('input')
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
            if (d.option !== 'useZoom' && useZoom) self.updateZoom()
            if (d.option == 'useZoom' && self.options[d.option]) self.updateZoom()
            self.redraw()
          }
          // callback
          if (typeof d.callback === 'function') d.callback(self, this, d)
        })

      _panelLabels.append('span')
        .text(d => d.text)

      _panel.exit().remove()
    }

    // Events
    d3.select(target)
      .on('click', this.chartClick.bind(this))

    this.g
      .on('mousemove.drag', this.mousemove.bind(this))
      .on('touchmove.drag', this.mousemove.bind(this))
      .on('mouseup.drag',   this.mouseup.bind(this))
      .on('touchend.drag',  this.mouseup.bind(this))
      .on('contextmenu', this.contextMenu.render(this))
  }

  initGlobalEvents(element = window){
    const self = this
    const { id } = this.options
    const keyCodes = [72, 86] // ['H', 'V']

    d3.select(element)
      .on('keydown.' + id, _ => {
        const { useZoom } = self.options
        const keyCode = d3.event.keyCode

        // horizontal (H) or vertical (V) zooming
        if ([72, 86].indexOf(keyCode) > -1 && self.keyPressed !== keyCode) {
          self.keyPressed = keyCode
          if (useZoom) self.updateZoom()
        }

        // clear selection (Esc)
        if (keyCode === 27 && Object.keys(self.selectedIndices).length) {
          self.clearSelection()
          self.saveRender()
          return
        }
      })
      .on('keyup.' + id, _ => {
        const { useZoom } = self.options

        // horizontal (H) or vertical (V) zooming
        if ([72, 86].indexOf(d3.event.keyCode) > -1) {
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

  // Render graph with zoom domains
  saveRender(){
    // set current domain after render
    const xDomain = this.x.domain()
    const yDomain = this.y.domain()
    this.render()
    this.x.domain(xDomain)
    this.y.domain(yDomain)
    if (this.options.useZoom) this.updateZoom()
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
    const { data, line, lines, dots, x, y, selected, seriesIndex } = this
    const { variables, xVariable, yVariables } = this.options

    lines.attr('d', v => {
      return line
        .defined((d, i) => isDefined(variables[v].accessor(d, i)))
        .y((d, i) => y(variables[v].accessor(d, i)))(data)
    })

    dots.selectAll('.dot')
      .data(v => data)
      .classed('selected', (d, i, s) => d.selected && d.selected.indexOf(s) > -1)
      .attr('cx', (d, i, s) => x(variables[xVariable].accessor(d, i)))
      .attr('cy', (d, i ,s) => y(variables[yVariables[s]].accessor(d, i)))
      .style('display', (d, i, s) => !isDefined(variables[yVariables[s]].accessor(d, i)) ? 'none' : null)

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
    const { useSelect } = this.options
    const self = this

    if (useSelect){
      // initialize selected indices if needed
      if (!self.selectedIndices[i]) self.selectedIndices[i] = []

      let idx = d.selected.indexOf(s)
      if (idx > -1) {
        d.selected.splice(idx, 1)
        self.selectedIndices[i].splice(idx, 1)
      } else {
        d.selected.push(s)
        self.selectedIndices[i].push(s)
      }

      self.redraw()

      // dispatch POINT CLICK event
      self.dispatch[EVENTS.POINT.CLICK](d, i, s)

      // trigger POINT SELECT event
      self.selectPointTrigger(self.selectedIndices)
    }

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

  brushed(){
    const self = this
    const { data, brush, dots } = this
    const { variables, xVariable, yVariables } = this.options
    const extent = brush.extent()

    // clear all selection
    data.forEach(d => d.selected = [])

    // clear current brush selected indices
    self.selectedIndicesExtra = {}

    // update dots with selected indices
    dots.selectAll('.dot')
      .classed('selected', (d, i, s) => {
        let selected = false

        // check if current point in brush extent and then add it to selection
        if (
          variables[xVariable].accessor(d, i) >= extent[0][0] &&
          variables[yVariables[s]].accessor(d, i) >= extent[0][1] &&
          variables[xVariable].accessor(d, i) <= extent[1][0] &&
          variables[yVariables[s]].accessor(d, i) <= extent[1][1]
        ) {
          d.selected.push(s)
          selected = true
        }

        if (selected) {
          if (!self.selectedIndicesExtra[i]) self.selectedIndicesExtra[i] = []
          self.selectedIndicesExtra[i].push(s)
        }
        else if (self.selectedIndices[i] && self.selectedIndices[i].indexOf(s) > -1) {
          d.selected.push(s)
          selected = true
        }

        return selected
      })
  }

  brushended(){
    const { brush, brushG } = this

    // update selected indices
    for (let i in this.selectedIndicesExtra) {
      if (!this.selectedIndices[i]) this.selectedIndices[i] = []
      this.selectedIndices[i] = this.selectedIndices[i].concat(this.selectedIndicesExtra[i])
    }

    // clear extra selected indices
    this.selectedIndicesExtra = {}

    // clear brush
    brush.clear()
    brushG.call(brush)

    // trigger POINT SELECT event
    this.selectPointTrigger(this.selectedIndices)
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

  // Dispatch POINT SELECT event
  selectPointTrigger(selectedIndices){
    const data = this.data

    // define selectedPoints
    let selectedPoints = []

    for (let i in selectedIndices) selectedPoints.push(data[i])

    // dispatch POINT SELECT event
    this.dispatch[EVENTS.POINT.SELECT](selectedPoints, selectedIndices)
  }

  clearSelection(){
    // clear selection if not useSelect mode
    this.data.forEach(d => d.selected = [])

    // reset selected indices
    this.selectedIndices = {}
  }
}