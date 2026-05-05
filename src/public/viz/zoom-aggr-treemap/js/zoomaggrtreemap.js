var util ={
    widthCalc: function (id){
	return document.getElementById(id).parentElement.clientWidth
    }
}

var zoomAggrTreemap = {
    generate: function (url,id){
	var margin = {top: 20, right: 0, bottom: 0, left: 0};
	var width = util.widthCalc('chart-parent')-30;
	var height = width*1.036 - margin.top - margin.bottom;
	
	var graph = {
	    url: url,
	    id:id,
	    margin: margin,
	    width:undefined,
	    height:undefined,
	    formatNumber: d3.format(",d"),
	    colorScale: d3.scale.category20(),
	    color: function(d){
		if (d.color){
		    return d.color;
		}else if(d.parent && d.parent.depth != 0){
		    return this.color(d.parent);
		}else{
		    return this.colorScale(d.name);
		}
	    },
	    transitioning: undefined,
	    x: d3.scale.linear().domain([0, width]).range([0, width]),
	    y: d3.scale.linear().domain([0, height]).range([0, height]),
	    treemap: d3.layout.treemap()
		.children(function(d, depth) { return depth ? null : d._children; })
		.sort(function(a, b) { return a.value - b.value; })
		.round(false)
		.ratio(height / width * 0.5 * (1 + Math.sqrt(5))),
	    svg: d3.select(id).append("svg")
		.attr("width", width + margin.left + margin.right)
		.attr("height", height + margin.bottom + margin.top)
		.style("margin-left", -margin.left + "px")
		.style("margin.right", -margin.right + "px")
		.append("g")
		.attr("transform", "translate(" + margin.left + "," + margin.top + ")")
		.style("shape-rendering", "crispEdges"),
	    grandparent: undefined,
	    name: function(d) {
		return d.parent? this.name(d.parent) + "." + d.name : d.name;
	    }
	};
	function init(){
	    graph.width = width;
	    graph.height = height;

	    //Set scales
	    
	    
	    graph.grandparent = graph.svg.append("g").attr("class", "grandparent");
	    graph.grandparent.append("rect")
		.attr("y", -margin.top)
		.attr("width", graph.width)
		.attr("height", margin.top);
	    
	    graph.grandparent.append("text")
		.attr("x", 6)
		.attr("y", 6 - margin.top)
		.attr("dy", ".75em");
	}
	init();

	d3.json(url, function(root) {
	    data_init(root);
	    display(root);

	    function data_init(root) {
		root.x = root.y = 0;
		root.dx = width;
		root.dy = height;
		root.depth = 0;

		// Aggregate the values for internal nodes. This is normally done by the
		// treemap layout, but not here because of our custom implementation.
		// We also take a snapshot of the original children (_children) to avoid
 		// the children being overwritten when when layout is computed.
		function accumulate(d) {
		    return (d._children = d.children)
			? d.value = d.children.reduce(function(p, v) { return p + accumulate(v); }, 0)
		    : d.value;
		}
		accumulate(root);

		// Compute the treemap layout recursively such that each group of siblings
		// uses the same size (1×1) rather than the dimensions of the parent cell.
		// This optimizes the layout for the current zoom state. Note that a wrapper
		// object is created for the parent node for each group of siblings so that
		// the parent’s dimensions are not discarded as we recurse. Since each group
		// of sibling was laid out in 1×1, we must rescale to fit using absolute
		// coordinates. This lets us use a viewport to zoom.
		function layout(d) {
		    if (d._children) {
			graph.treemap.nodes({_children: d._children});
		    d._children.forEach(function(c) {
			c.x = d.x + c.x * d.dx;
			c.y = d.y + c.y * d.dy;
			c.dx *= d.dx;
			c.dy *= d.dy;
			c.parent = d;
			layout(c);
		    });
		    }
		}
		layout(root);
	    }

	    function display(d) {
		graph.grandparent
		    .datum(d.parent)
		    .on("click", transition)
		    .select("text")
		    .text(graph.name(d));

		var g1 = graph.svg.insert("g", ".grandparent")
		    .datum(d)
		    .attr("class", "depth");

		var g = g1.selectAll("g")
		    .data(d._children)
		    .enter().append("g");

		g.filter(function(d) { return d._children; })
		    .classed("children", true)
		    .on("click", transition);
		
		g.selectAll(".child")
		    .data(function(d) { return d._children || [d]; })
		    .enter().append("rect")
		    .style('fill', function(d) { return graph.color(d); })
		    .attr("class", "child")
		    .call(rect);

		g.append("rect")
		    .attr("class", "parent")
		    .style('fill', function(d) { return graph.color(d); })
		    .call(rect)
		    .append("title")
		    .text(function(d) { return graph.formatNumber(d.value); });

		g.append("text")
		    .attr("dy", ".75em")
		    .text(function(d) { return d.name; })
		    .call(text);

		function transition(d){
		    if (graph.transitioning || !d) return;
		    graph.transitioning = true;
		    
		    var g2 = display(d),
			t1 = g1.transition().duration(750),
			t2 = g2.transition().duration(750);
		    
		    // Update the domain only after entering new elements.
		    graph.x.domain([d.x, d.x + d.dx]);
		    graph.y.domain([d.y, d.y + d.dy]);
		    
		    // Enable anti-aliasing during the transition.
		    graph.svg.style("shape-rendering", null);
		    
		    // Draw child nodes on top of parent nodes.
		    graph.svg.selectAll(".depth").sort(function(a, b) { return a.depth - b.depth; });
		    
		    // Fade-in entering text.
		    g2.selectAll("text").style("fill-opacity", 0);
		    
		    // Transition to the new view.
		    t1.selectAll("text").call(text).style("fill-opacity", 0);
		    t2.selectAll("text").call(text).style("fill-opacity", 1);
		    t1.selectAll("rect").call(rect);
		    t2.selectAll("rect").call(rect);
		    
		    // Remove the old node when the transition is finished.
		    t1.remove().each("end", function() {
			graph.svg.style("shape-rendering", "crispEdges");
			graph.transitioning = false;
		    });
		}
		return g;
	    }
	    
	    function text(text) {
		text.attr("x", function(d) { return graph.x(d.x) + 6; })
		    .attr("y", function(d) { return graph.y(d.y) + 6; });
	    }
	    
	    function rect(rect) {
		rect.attr("x", function(d) { return graph.x(d.x); })
		    .attr("y", function(d) { return graph.y(d.y); })
		    .attr("width", function(d) { return graph.x(d.x + d.dx) - graph.x(d.x); })
		    .attr("height", function(d) { return graph.y(d.y + d.dy) - graph.y(d.y); });
	    }
	});

	return graph;
    }
};

document.addEventListener("DOMContentLoaded", function(event){
    var tree = zoomAggrTreemap.generate('json/data.json','#chart');
});
