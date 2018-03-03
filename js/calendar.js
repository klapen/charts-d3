(function(){
    window.calendar = {
	getChartDimensions: function(graph){
	    if (!graph.id) throw "Graph requires an ID"; 
	    
	    var width = utils.widthCalc(graph.id);
	    var height = utils.heightCalc(graph.id);
	    var margin = {top: (0.04*height), right: (0.03125*width), bottom: (0.06*height), left: (0.04166*width)};
	    
	    graph.margin= margin;
	    graph.width= width - margin.left - margin.right;
	    graph.height= height - margin.top - margin.bottom;
	    graph.cellSize = width/53;
	    graph.color = d3.scaleQuantize().domain([-.05, .05])
		.range(d3.range(11).map(function(d) { return "q" + d + "-11"; }));
	    
	    if(graph.svg) d3.select('#'+graph.id).select('svg').remove();
	    graph.svg = d3.select('#'+graph.id).append('svg').attr('width', width).attr('height', height);
	},
	loadDataFromFile: function(graph,url){
	    var that = this;
	    
	    function type(d) {
		d.value = +d.value; // coerce to number
		return d;
	    };
	    var ext = url.split('.')[1];
	    if (ext == 'tsv'){
		d3.tsv(url, type, function(error, data) {
		    that.updateData(graph,data);
		});
	    }else if(ext == 'csv'){
		d3.csv(url, type, function(error, data) {
		    that.updateData(graph,data);
		}); 
	    }else if (ext == 'json'){
		d3.json(url, type, function(error, data) {
		    that.updateData(graph,data);
		});	    
	    }
	},
	updateData: function(graph,data){
	    var that = this;
	    var yr = graph.svg.selectAll('g').data([2018]).enter().append('g')
		//.attr("transform",  utils.translation((graph.width - graph.cellSize * 53)/2, graph.height-graph.cellSize*7-1));

	    yr.append('text')
		.attr("transform", "translate(-6," + graph.cellSize * 3.5 + ")rotate(-90)")
		.style("text-anchor", "middle")
		.text(function(d) { return d; });
	    
	    var day = yr.selectAll('.day')
		.data(function(d){return d3.timeDays(new Date(d,0,1),new Date(d+1,0,1))})
		.enter().append('rect')
		.attr('class','day')
		.attr('width',graph.cellSize).attr('height',graph.cellSize)
		.attr("x", function(d) { return d3.timeWeek.count(d3.timeYear(d), d) * graph.cellSize; })
		.attr("y", function(d) { return d.getDay() * graph.cellSize; })

	    var month = yr.selectAll('.month')
		.data(function(d) { return d3.timeMonths(new Date(d, 0, 1), new Date(d + 1, 0, 1)); })
		.enter().append("path")
		.attr("class", "month")
		.attr("d", monthPath);

	    function monthPath(t0) {
		var t1 = new Date(t0.getFullYear(), t0.getMonth() + 1, 0),
		    d0 = t0.getDay(), w0 = d3.timeWeek.count(d3.timeYear(t0), t0)
		d1 = t1.getDay(), w1 = d3.timeWeek.count(d3.timeYear(t1), t1);
		return "M" + (w0 + 1) * graph.cellSize + "," + d0 * graph.cellSize
		    + "H" + w0 * graph.cellSize + "V" + 7 * graph.cellSize
		    + "H" + w1 * graph.cellSize + "V" + (d1 + 1) * graph.cellSize
		    + "H" + (w1 + 1) * graph.cellSize + "V" + 0
		    + "H" + (w0 + 1) * graph.cellSize + "Z";
	    };	    
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
