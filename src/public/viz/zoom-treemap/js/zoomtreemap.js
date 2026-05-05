var zoomTreemap = {
    generate: function(url,id){
	function size(d){return d.size;};
	function count(d){return 1;};
	function zoom(tree,parent) {
	    var d = tree.node == parent ? tree.root : parent;
	    var kx = tree.w / d.dx, ky = tree.h / d.dy;
	    tree.x.domain([d.x, d.x + d.dx]);
	    tree.y.domain([d.y, d.y + d.dy]);
	    
	    var t = tree.svg.selectAll('g.cell').transition()
		.duration(d3.event.altKey ? 7500 : 750)
		.attr('transform', function(d) { return 'translate(' + tree.x(d.x) + ',' + tree.y(d.y) + ')'; });
	    
	    t.select('rect')
		.attr('width', function(d) { return kx * d.dx - 1; })
		.attr('height', function(d) { return ky * d.dy - 1; })
	    
	    t.select('text')
		.attr('x', function(d) { return kx * d.dx / 2; })
		.attr('y', function(d) { return ky * d.dy / 2; })
		.style('opacity', function(d) { return kx * d.dx > d.w ? 1 : 0; });
	    
	    tree.node = d;
	    d3.event.stopPropagation();
	};
	function change(value){
	    console.log(value);
	    this.treemap.value(value == 'size' ? this.size : this.count).nodes(this.root);
	    this.zoom(this,this.node);
	}

	var that = {
	    id:id,
	    ztree: undefined,
	    w: 1280 - 80,
	    h: 800 - 180,
	    color: d3.scale.category20c(),
	    x: undefined,
	    y: undefined,
	    root: undefined,
	    node: undefined,
	    treemap: undefined,
	    svg: undefined,
	    size: size,
	    count: count,
	    zoom: zoom,
	    change: change
	};
	d3.json(url, function(data) {
	    // Init varibles 
	    that.x = d3.scale.linear().range([0, that.w]);
	    that.y = d3.scale.linear().range([0, that.h]);
	    that.treemap = d3.layout.treemap()
			 .round(false)
			 .size([that.w, that.h])
			 .sticky(true)
			 .value(function(d){return d.size;});
	    that.svg = d3.select(id).append('div')
		    .attr('class', 'chart')
		    .style('width', that.w + 'px')
		    .style('height', that.h + 'px')
		    .append('svg:svg')
		    .attr('width', that.w)
		    .attr('height', that.h)
		    .append('svg:g')
		    .attr('transform', 'translate(.5,.5)');
	    that.node = that.root = data;

	    var nodes = that.treemap.nodes(that.root)
		.filter(function(d) { return !d.children; });

	    var cell = that.svg.selectAll('g')
		.data(nodes)
		.enter().append('svg:g')
		.attr('class', 'cell')
		.attr('transform', function(d) { return 'translate(' + d.x + ',' + d.y + ')'; })
		.on('click', function(d){return zoom(that,d.parent);});

	    cell.append('svg:rect')
		.attr('width', function(d) { return d.dx - 1; })
		.attr('height', function(d) { return d.dy - 1; })
		.style('fill', function(d) { return that.color(d.parent.name); });

	    cell.append('svg:text')
		.attr('x', function(d) { return d.dx / 2; })
		.attr('y', function(d) { return d.dy / 2; })
		.attr('dy', '.35em')
		.attr('text-anchor', 'middle')
		.text(function(d) { return d.name; })
		.style('opacity', function(d) { d.w = this.getComputedTextLength(); return d.dx > d.w ? 1 : 0; });

	    d3.select(id).on('click', function(){zoom(that,that.root);});
	});
	that.ztree = that;
	return that;
    },
   
}
$(document).ready(function(){
    oas = zoomTreemap.generate('json/flare.json','#first');
    blah = zoomTreemap.generate('json/blah.json','#second');
    d3.select('select').on('change', function() {
	oas.change(this.value);
	blah.change(this.value);
    });
})
