import d3 from 'd3'
import { EVENTS } from './Events'
import { polygon, quadTreeSearch } from './utils'

/**
 * Default config
 */
const defaults = {
  margin: {top: 23, right: 20, bottom: 40, left: 40},
  xVariable: 'x',
  yVariable: 'y',
  groupVariable: 'group',
  variables: {
    x: { name: 'X', accessor: d => d.x },
    y: { name: 'Y', accessor: d => d.y },
    group: {
      name: 'Group',
      accessor: d => d.group,
      values: {
        0: { id: 0 },
        1: { id: 1 }
      }
    }
  },
  colors: d3.scale.category20().range().slice(10),
  useEdit: true,
  useZoom: true,
  useSelect: false,
  useAdd: false,
  useRemove: false,
  useVoronoi: false,
  usePanel: true,
  panel: [
    { type: 'checkbox', text: 'Edit', visible: true, option: 'useEdit' },
    { type: 'checkbox', text: 'Zoom', visible: true, option: 'useZoom' },
    { type: 'button', text: 'Reset', visible: true, callback: chart => chart.reset() }
  ],
  groupPanel: {
    selectedIndex: 0
  },
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
 * Scatter chart class
 */
export class ScatterChart {

  constructor(options = {}, data = []){
    this.options = {}
    this.dispatch = d3.dispatch(
      EVENTS.POINT.CLICK,
      EVENTS.POINT.DRAG,
      EVENTS.POINT.ADD,
      EVENTS.POINT.REMOVE,
      EVENTS.POINT.SELECT
    )
    // initialize array of selected point indices
    this.selectedIndices = []
    this.selectedIndicesExtra = []

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

    // define unique groups when specifying data
    this.uniqueGroups = this.getUniqueGroups()

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
    const { variables, xVariable, yVariable } = options

    options.xMax = d3.max(data, variables[xVariable].accessor)
    options.xMin = d3.min(data, variables[xVariable].accessor)
    options.yMax = d3.max(data, variables[yVariable].accessor)
    options.yMin = d3.min(data, variables[yVariable].accessor)
  }

  getUniqueGroups(){
    const { variables, groupVariable } = this.options
    return Object.keys(variables[groupVariable].values)
    //const { data } = this
    //const { variables, groupVariable } = this.options
    //let groups = [], g
    //for (let i = 0, l = data.length; i < l; i++) {
    //  g = variables[groupVariable].accessor(data[i])
    //  if (groups.indexOf(g) == -1) groups.push(g)
    //}
    //return groups.sort()
  }

  init(){
    let self = this
    const { options, data, selectedIndices, uniqueGroups } = this

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
      yVariable,
      groupVariable,
      colors,
      legend,
      useEdit,
      useZoom,
      useSelect,
      useAdd,
      useRemove,
      useVoronoi,
      usePanel,
      panel,
      groupPanel
      } = options

    // recalculate data with selections
    data.forEach(d => d.selected = false)
    selectedIndices.forEach(i => data[i].selected = true)

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

    this.xAxisZoom = d3.behavior.zoom()
      .x(this.x)
      .on('zoom', this.zoomed.bind(this))

    this.yAxisZoom = d3.behavior.zoom()
      .y(this.y)
      .on('zoom', this.zoomed.bind(this))

    // define dragged point
    this.dragged = null

    // Voronoi diagram
    this.voronoi = d3.geom.voronoi()
      .x((d, i) => self.x(variables[xVariable].accessor(d, i)))
      .y((d, i) => self.y(variables[yVariable].accessor(d, i)))
      .clipExtent([[0, 0], [w, h]])

    // Quad Tree
    this.quadTree = d3.geom.quadtree()
      .x(variables[xVariable].accessor)
      .y(variables[yVariable].accessor)
      .extent([[-1, -1], [w + 1, h + 1]])
      (data)

    // Brush
    this.brush = d3.svg.brush()
      .x(self.x)
      .y(self.y)
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

    // Voronoi diagram
    if (useVoronoi) {
      this.voronoiPath = this.g.append('g')
        .attr('class', 'voronoi')
        .selectAll("path")

      this.doVoronoi()
    }

    // Dots
    const dots = this.g.append('g')
      .attr('class', 'dots')
      .attr('clip-path', 'url(#clip)')

    this.dot = dots.selectAll('.dot')
      .data(data)
      .enter()
      .append('circle')
      .attr('class', 'dot')

    this.dot
      .classed('selected', d => d.selected )
      .attr('cx', (d, i) => self.x(variables[xVariable].accessor(d, i)))
      .attr('cy', (d, i) => self.y(variables[yVariable].accessor(d, i)))
      .attr('r', 5.0)
      .style('stroke', (d, i) => {
        const groupName = variables[groupVariable].accessor(d, i)
        const group = variables[groupVariable].values[groupName]
        return group.color || colors[group.id]
      })
      .style('fill', (d, i) => {
        const groupName = variables[groupVariable].accessor(d, i)
        const group = variables[groupVariable].values[groupName]
        return group.color || colors[group.id]
      })
      .style('cursor', 'pointer')
      .on('click',  this.pointClick.bind(this))

      if (useEdit) {
        this.dot
          .on('mousedown.drag',  this.pointDrag.bind(this))
          .on('touchstart.drag', this.pointDrag.bind(this))
      }

    // add brush to dots
    this.brushG = dots.append('g')
      .attr('class', 'brush')

    if (useSelect) {
      this.brushG
        .call(this.brush)
        .call(this.brush.event)
    }

    // Legend
    // TODO: now translate is for horizontal legend
    this.legend = this.svg.append('g')
      .attr('class', 'legend')
      .attr('transform', `translate(${ legend.align === 'left' ? width - margin.right - legend.x - uniqueGroups.length * legend.itemWidth : margin.left + legend.x }, ${legend.y})`);

    const items = this.legend.selectAll('legend-item')
      .data(uniqueGroups)

    const item = items.enter()
      .append('g')
      .attr('class', 'legend-item')
      .attr('transform', (g, i) => legend.isHorizontal
        ? `translate(${i * legend.itemWidth}, 0)`
        : `translate(0, ${i * legend.itemHeight})`
      )

    item
      .append('rect')
      .attr('width', legend.itemHeight)
      .attr('height', legend.itemHeight)
      .attr('fill', groupName => {
        const group = variables[groupVariable].values[groupName]
        return group.color || colors[group.id]
      })

    item.append('text')
      .text(g => g)
      .attr('x', legend.itemHeight + legend.gap)
      .attr('y', g => legend.itemHeight - 1)

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

      // group panel
      if (useAdd) {
        const _groupPanel = _panelContainer.append('div')
          .attr('class', 'group-panel')
          .selectAll('.panel-item')
          .data(uniqueGroups)

        const _groupPanelLabels = _groupPanel.enter()
          .append('div')
          .attr('class', 'panel-item')
          .append('label')

        const _inputs = _groupPanelLabels.append('input')
          .attr('type', 'checkbox')
          .attr('checked', (d, i) => i === groupPanel.selectedIndex ? 'checked' : null)
          .attr('hidden', '')
          .on('click', function(d, i) {
            groupPanel.selectedIndex = i
            _inputs.attr('checked', (d, i) => i === groupPanel.selectedIndex ? 'checked' : null)
          })

        _groupPanelLabels.append('span')
          .style('background-color', groupName => {
            const group = variables[groupVariable].values[groupName]
            return group.color || colors[group.id]
          })
          .text(d => d)

        _groupPanel.exit().remove()
      }
    }

    // Events
    d3.select(target)
      .on('click', this.chartClick.bind(this))

    this.g
      .on('mousemove.drag', this.mousemove.bind(this))
      .on('touchmove.drag', this.mousemove.bind(this))
      .on('mouseup.drag',   this.mouseup.bind(this))
      .on('touchend.drag',  this.mouseup.bind(this))
      .on('click',  this.gClick.bind(this))
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

  clearSelection(){
    // clear selection if not useSelect mode
    this.dot.each(d => d.selected = false)

    // reset selected indices
    this.selectedIndices = []
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

  doVoronoi(){
    const { data, voronoi } = this
    const { variables, groupVariable } = this.options
    let { voronoiPath } = this

    // update voronoi
    this.g.select('.voronoi').selectAll('path').remove()

    voronoiPath = voronoiPath.data(voronoi(data), polygon)

    voronoiPath.enter().append('path')
      .attr('d', polygon)
      .style('fill', (d, i) => {
        const groupName = variables[groupVariable].accessor(d.point, i)
        const group = variables[groupVariable].values[groupName]
        return group.color || colors[group.id]
      })
      .style('fill-opacity', .2)
      .attr('pointer-events', 'none')

    voronoiPath.order()

    voronoiPath.exit().remove()
  }

  update() {
    const { dot, x, y } = this
    const { variables, xVariable, yVariable, useVoronoi } = this.options

    // update voronoi diagram
    if (useVoronoi) this.doVoronoi()

    // update dots
    dot
      .classed('selected', d => d.selected )
      .attr('cx', (d, i) => x(variables[xVariable].accessor(d, i)))
      .attr('cy', (d, i) => y(variables[yVariable].accessor(d, i)))

    if (d3.event && d3.event.keyCode) {
      d3.event.preventDefault()
      d3.event.stopPropagation()
    }
  }

  chartClick() {
    this.dragged = null
    this.update()
  }

  gClick(){
    const { variables, xVariable, yVariable, groupVariable, useAdd, groupPanel } = this.options
    const self = this, p = d3.mouse(self.g[0][0])

    if (useAdd) {
      const groups = Object.keys(variables[groupVariable].values)

      let pointToAdd = {}
      pointToAdd[xVariable] = self.x.invert(Math.max(0, Math.min(self.options.w, p[0])))
      pointToAdd[yVariable] = self.y.invert(Math.max(0, Math.min(self.options.h, p[1])))
      pointToAdd[groupVariable] = groups[groupPanel.selectedIndex]

      const index = self.addPoint(pointToAdd)

      // dispatch POINT ADD event
      self.dispatch[EVENTS.POINT.ADD](pointToAdd, index)

      // set current domain after render
      const xDomain = self.x.domain()
      const yDomain = self.y.domain()
      self.render()
      self.x.domain(xDomain)
      self.y.domain(yDomain)
      if (self.options.useZoom) self.updateZoom()
      self.redraw()
    }
  }

  pointDrag(d, i) {
    const self = this

    if (d3.event) {
      d3.event.preventDefault()
      d3.event.stopPropagation()
    }

    //d.selected = true
    self.dragged = d
    self.pointIndex = i

    //// add the current point to selected indices
    //if (self.selectedIndices.indexOf(i) === -1) self.selectedIndices.push(i)

    self.update()
  }

  pointClick(d, i){
    const { useEdit, useRemove } = this.options
    const self = this

    if (useEdit){
      // dispatch POINT CLICK event
      self.dispatch[EVENTS.POINT.CLICK](d, i)

      if (d.selected)
        d.selected = false
      else
        d.selected = true

      // add the current point to selected indices
      const idx = self.selectedIndices.indexOf(i)
      if (d.selected && idx === -1) self.selectedIndices.push(i)
      if (!d.selected && idx > -1) self.selectedIndices.splice(idx, 1)

      self.redraw()
    }
    else if (useRemove) {
      // dispatch POINT REMOVE
      self.dispatch[EVENTS.POINT.REMOVE](d, i)
      self.removePoint(i)

      // set current domain after render
      const xDomain = self.x.domain()
      const yDomain = self.y.domain()
      self.render()
      self.x.domain(xDomain)
      self.y.domain(yDomain)
      if (self.options.useZoom) self.updateZoom()
      self.redraw()
    }

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
  }

  mouseup() {
    const self = this

    self.g.style("cursor", "auto")

    if (self.dragged) {
      self.dispatch[EVENTS.POINT.DRAG](self.dragged, self.pointIndex)
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
    const { quadTree, brush, dot } = this
    const { variables, xVariable, yVariable } = this.options
    const extent = brush.extent()
    const xAccessor = variables[xVariable].accessor
    const yAccessor = variables[yVariable].accessor

    // reset selectedIndicesFromBrush
    self.selectedIndicesExtra = []

    dot.each(d => d.selected = false)

    quadTreeSearch(quadTree, extent, xAccessor, yAccessor)

    dot.classed('selected', (d, i) => {
      if (self.selectedIndices.indexOf(i) > -1) {
        d.selected = true
      }
      else if (d.selected) {
        self.selectedIndicesExtra.push(i)
      }

      return d.selected
    })

    // trigger POINT SELECT event
    this.selectPointTrigger(self.selectedIndices.concat(self.selectedIndicesExtra))
  }

  brushended(){
    const { brush, brushG } = this

    // update selected indices
    this.selectedIndices = this.selectedIndices.concat(this.selectedIndicesExtra)

    // clear extra selected indices
    this.selectedIndicesExtra = []

    // clear brush
    brush.clear()
    brushG.call(brush)
  }

  reset(){
    const self = this

    // clear selection
    self.clearSelection()

    // recalculate limits
    self.calculateLimits()

    // reset zoom
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

  selectPointTrigger(selectedIndices){
    const data = this.data

    // define selectedPoints
    let selectedPoints = []

    selectedIndices.forEach(i => selectedPoints.push(data[i]))

    // dispatch POINT SELECT event
    this.dispatch[EVENTS.POINT.SELECT](selectedPoints, selectedIndices)
  }

  // data manipulation
  addPoint(point){
    this.data.push(point)

    // return last index
    return this.data.length - 1
  }

  removePoint(index){
    this.data.splice(index, 1)
  }
}