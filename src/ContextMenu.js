import d3 from 'd3'

/**
 * Context menu class
 */
export class ContextMenu {
  constructor(options = {}){
    this.options = {}

    this.setOptions(options)

    this.init()
  }

  setOptions(_){
    const defaults = {
      items: []
    }

    Object.assign(this.options, defaults, _)
  }

  init(){
    d3.select('body').on('click.context-menu', this.clear)
  }

  render(chart){
    const self = this
    const { options } = this

    return function(data, index, s){
      const elem = this

      // remove context menu
      self.clear()

      // create new
      const menu = d3.selectAll('.context-menu')
        .data([1])
        .enter()
        .append('div')
        .attr('class', 'context-menu')
        .style('left', (d3.event.pageX) + 'px')
        .style('top', (d3.event.pageY) + 'px')
        .style('display', 'block')
        .append('ul')

      const item = menu.selectAll('li')
        .data(typeof options.items === 'function' ? options.items(data, index, s) : options.items)
        .enter()
        .append('li')
        .html(d => typeof d.title === 'function' ? d.title(data, index, s) : d.title)
        .on('click', (d, i) => {
          if (d.disabled) return
          if (d.action) d.action(chart, elem, data, index, s)

          //clear
          self.clear()
        })

      d3.event.preventDefault();
      d3.event.stopPropagation();
    }
  }

  clear(){
    d3.selectAll('.context-menu').remove()
  }
}