(function(){
    // end helper functions
    window.stackarea = {
	getChartDimensions: function(graph){
	    if (!graph.id) throw "Graph requires an ID"; 
	    
	    var width = utils.widthCalc(graph.id);
	    var height = utils.heightCalc(graph.id);
	    var margin = {top: (0.04*height), right: (0.03125*width), bottom: (0.06*height), left: (0.04166*width)};
	    
	    graph.margin= margin;
	    graph.width= width;// - margin.left - margin.right;
	    graph.height= height;// - margin.top - margin.bottom;

	    graph.x = d3.scaleBand().rangeRound([0,graph.width - margin.left - margin.right]);
	    graph.y = d3.scaleLinear().range([graph.height  - margin.top - margin.bottom,0]);
	    graph.color = d3.scaleOrdinal(d3.schemeCategory10);

	    graph.stack = d3.stack();

	    if(graph.svg) d3.select('#'+graph.id).select('svg').remove();
	    graph.svg = d3.select('#'+graph.id).append('svg')
		.attr('width', graph.width).attr('height', graph.height);
	},
	// ToDo: Refactor on utils using callback
	loadDataFromFile: function(graph,selector,url,callback){
	    var that = this;
	    graph.dataCallback = callback;
	    graph.selector = selector;
	    
	    var ext = url.split('.')[1];

	    if (ext == 'tsv'){
		d3.tsv(url, function(error, data) {
		    if (error) throw error;
		    that.updateData(graph,data);
		});
	    }else if(ext == 'csv'){
		d3.csv(url, function(error, data) {
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
	drawChart:function(graph,data){
	    console.log(data)
	    var area = d3.area()
		.x(function(d, i) { return graph.x(d.data.category); })
		.y0(function(d) { return graph.y(d[0]); })
		.y1(function(d) { return graph.y(d[1]); });
	    
	    var keys = data.columns.slice(2);
	    
	    graph.x.domain(data.map(function(d) { return d.category; }));
	    graph.color.domain(keys);
	    graph.stack.keys(keys);

	    var x_offset = graph.x.bandwidth()/2;

	    var g = graph.svg.append("g")
		.attr('transform',utils.translation(graph.margin.left,graph.margin.top))
	    
	    var layer = g.selectAll(".layer")
		.data(graph.stack(data))
		.enter().append("g")
		.attr("class", "layer");
	    
	    layer.append("path")
		.attr("class", "area")
		.style("fill", function(d) { return graph.color(d.key); })
		.attr("d", area);
	    
	    layer.append("text")
		.attr("x", graph.width-graph.margin.left-graph.margin.right - (1.5*x_offset))
		.attr("y", function(d) { return graph.y((d[d.length - 1][0] + d[d.length - 1][1]) / 2); })
		.attr("dy", ".35em")
		.style("font", "10px sans-serif")
		.style("text-anchor", "end")
		.text(function(d) { return d.key; });
	   
	    var x_axis = g.append("g")
	    	.attr("class", "axis axis--x")
	    	.attr("transform", utils.translation(0, graph.height-graph.margin.bottom-graph.margin.top))
	    	.call(d3.axisBottom(graph.x));
	    
	    x_axis.select('path').remove()
	    x_axis.selectAll('line').attr('transform',utils.translation(-x_offset,0))
	    x_axis.selectAll('text').attr('transform',utils.translation(-x_offset,0))
	    
	    g.append("g")
	    	.attr("class", "axis axis--y")
	    	.call(d3.axisLeft(graph.y).ticks(10, "%"));
	},
	updateData: function(graph,data){
	    var that = this;
	    graph.data = data;
	    var order_data = graph.dataCallback(data);
	    that.drawChart(graph,order_data);
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
