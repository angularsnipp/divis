import d3 from 'd3'

/**
 * Tooltip class
 */
export class Tooltip {
  constructor(target, options = {}){
    this.options = {}
    this.target = target || 'body'
    this._content = ''

    this.setOptions(options)

    this.init()
  }

  setOptions(_){
    const defaults = {
      dx: -20,
      dy: -25
    }

    Object.assign(this.options, defaults, _)
  }

  init(){
    this.el = d3.select(this.target).append('div')
      .attr('class', 'divis-tooltip')
      .style('display', 'none')

    return this
  }

  show(el){
    const { dx, dy } = this.options
    this.el.html(this._content)

    const xPosition = d3.mouse(el)[0] + dx
    const yPosition = d3.mouse(el)[1] + dy

    this.el.style('top', yPosition + 'px')
    this.el.style('left', xPosition + 'px')

    this.el.style('display', null)

    return this
  }

  hide(){
    this.el.style('display', 'none')
    return this
  }

  content(_){
    if (!arguments.length) return this._content
    this._content = _
    return this
  }
}