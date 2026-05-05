(function(){
    // end helper functions
    window.sunburst = {
	getChartDimensions: function(graph){
	    if (!graph.id) throw "Graph requires an ID"; 
	    
	    var width = utils.widthCalc(graph.id);
	    var height = utils.heightCalc(graph.id);
	    var margin = {top: (0.04*height), right: (0.03125*width), bottom: (0.06*height), left: (0.04166*width)};
	    
	    graph.margin= margin;
	    graph.width= width - margin.left - margin.right;
	    graph.height= height - margin.top - margin.bottom;

	    graph.radius = (Math.min(graph.width,graph.height)/2) -10;
	    graph.x = d3.scaleLinear().range([0, 2*Math.PI]);
	    graph.y = d3.scaleSqrt().range([0,graph.radius]);
	    graph.color = d3.scaleOrdinal(d3.schemeCategory20);

	    graph.partition = d3.partition();

	    graph.arc = d3.arc()
		.startAngle(function(d) { return Math.max(0, Math.min(2 * Math.PI, graph.x(d.x0))); })
		.endAngle(function(d) { return Math.max(0, Math.min(2 * Math.PI, graph.x(d.x1))); })
		.innerRadius(function(d) { return Math.max(0, graph.y(d.y0)); })
		.outerRadius(function(d) { return Math.max(0, graph.y(d.y1)); });

	    
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
	    graph.root = d3.hierarchy(data);
	    graph.root.sum(function(d){return d.size});

	    var color = function(d){return graph.color((d.children ? d:d.parent).data.name)};
	    graph.chart.selectAll('path')
		.data(graph.partition(graph.root).descendants())
		.enter().append('path')
		.attr('d',graph.arc)
		.style('fill',color)
		.style('stroke','white')
		.on('click',click)
		.append('title').text(function(d){ return d.data.name+"\n"+d.value});

	    function click(d) {
		graph.chart.transition()
		    .duration(750)
		    .tween("scale", function() {
			var xd = d3.interpolate(graph.x.domain(), [d.x0, d.x1]),
			    yd = d3.interpolate(graph.y.domain(), [d.y0, 1]),
			    yr = d3.interpolate(graph.y.range(), [d.y0 ? 20 : 0, graph.radius]);
			return function(t) { graph.x.domain(xd(t)); graph.y.domain(yd(t)).range(yr(t)); };
		    })
		    .selectAll("path")
		    .attrTween("d", function(d) { return function() { return graph.arc(d); }; });
	    }
	},
	updateData: function(graph,data){
	    var that = this;
	    graph.data = data;
	    var order_data = graph.dataCallback(data);
	    
	    graph.chart = graph.svg.append('g')
		.attr('transform', utils.translation(graph.width/2, graph.height/2));

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
