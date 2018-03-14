(function(){
    // end helper functions
    window.pack = {
	getChartDimensions: function(graph){
	    if (!graph.id) throw "Graph requires an ID"; 
	    
	    var width = utils.widthCalc(graph.id);
	    var height = utils.heightCalc(graph.id);
	    var margin = {top: (0.04*height), right: (0.03125*width), bottom: (0.06*height), left: (0.04166*width)};
	    
	    graph.margin= margin;
	    graph.width= width - margin.left - margin.right;
	    graph.height= height - margin.top - margin.bottom;

	    graph.diameter = graph.width < graph.height ? graph.width : graph.height;

	    graph.color = d3.scaleLinear()
		.domain([-1, 5])
		.range(["hsl(152,80%,80%)", "hsl(228,30%,40%)"])
		.interpolate(d3.interpolateHcl);
	    
	    graph.pack = d3.pack()
		.size([graph.diameter - graph.margin.right, graph.diameter - graph.margin.right])
		.padding(2);
	    
	    if(graph.svg) d3.select('#'+graph.id).select('svg').remove();
	    graph.svg = d3.select('#'+graph.id).append('svg')
		.attr('width', graph.diameter).attr('height', graph.diameter);
	},
	// ToDo: Refactor on utils using callback
	loadDataFromFile: function(graph,url){
	    var that = this;
	    
	    function type(d) {
		Object.keys(d).map(function(key){
		    if (key != 'name') d[key] = +d[key];
		})
		return d;
	    };
	    var ext = url.split('.')[1];

	    if (ext == 'tsv'){
		d3.tsv(url, type, function(error, data) {
		    if (error) throw error;
		    that.updateData(graph,data);
		});
	    }else if(ext == 'csv'){
		d3.csv(url, type, function(error, data) {
		    if (error) throw error;
		    that.updateData(graph,data);
		}); 
	    }else if (ext == 'json'){
		d3.json(url, function(error, data) {
		    if (error) throw error;
		    that.updateData(graph,data);
		});	    
	    }
	},
	updateData: function(graph,data){
	    var that = this;
	    graph.data = data;

	    graph.root = d3.hierarchy(data)
		.sum(function(d){return d.size})
		.sort(function(a,b){return b.value - a.value});

	    graph.focus = graph.root;
	    graph.nodes = graph.pack(graph.root).descendants();

	    graph.chart = graph.svg.append("g")
		.attr("transform", utils.translation(graph.diameter/2, graph.diameter/2));

	    var circle = graph.chart.selectAll('circle')
		.data(graph.nodes)
		.enter().append('circle')
		.attr("class", function(d) {
		    return d.parent ? d.children ? "node" : "node node--leaf" : "node node--root";
		}).style("fill", function(d) { return d.children ? graph.color(d.depth) : null; })
		.on("click", function(d) {
		    if (focus !== d) zoom(d), d3.event.stopPropagation();
		});

	    // ToDo: Add text
	    var text = graph.chart.selectAll("text")
		.data(graph.nodes)
		.enter().append("text")
		.attr("class", "label")
		.style("fill-opacity", function(d) { return d.parent === graph.root ? 1 : 0; })
		.style("display", function(d) { return d.parent === graph.root ? "inline" : "none"; })
		.text(function(d) { return d.data.name; });

	    graph.node = graph.chart.selectAll('circle,text');
	    
	    graph.svg.style('background',graph.color(-1))
		.on('click',function(){zoom(graph.root)});

	    zoomTo([graph.root.x,graph.root.y,graph.root.r*2 + graph.margin.right]);

	    function zoom(d) {
		var focus0 = graph.focus;
		graph.focus = d;
		
		var transition = d3.transition()
		    .duration(d3.event.altKey ? 7500 : 750)
		    .tween('zoom', function(d) {
			var i = d3.interpolateZoom(graph.view,
						   [graph.focus.x, graph.focus.y, graph.focus.r * 2 + graph.margin.right]);
			return function(t) { zoomTo(i(t)); };
		    });
		
		transition.selectAll('text')
		    .filter(function(d) { return d.parent === graph.focus || this.style.display === 'inline'; })
		    .style('fill-opacity', function(d) { return d.parent === graph.focus ? 1 : 0; })
		    .on('start', function(d) { if (d.parent === graph.focus) this.style.display = 'inline'; })
		    .on('end', function(d) { if (d.parent !== graph.focus) this.style.display = 'none'; });
	    }
	    
	    function zoomTo(v) {
		var k = graph.diameter / v[2];
		graph.view = v;
		graph.node.attr('transform', function(d) {
		    return utils.translation((d.x - v[0]) * k, (d.y - v[1]) * k);
		});
		circle.attr('r', function(d) { return d.r * k; });
	    }
	    
	},
	onResize: function(graph){
	    this.getChartDimensions(graph);
	    this.updateData(graph.data,graph);
	},
	generate: function(id){
	    var that = this;
	    var graph = {id:id};
	    this.getChartDimensions(graph);
	    window.onresize = function(){that.onResize(graph)};
	    return graph;
	}
    }
})();
