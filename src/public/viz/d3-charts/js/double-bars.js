(function(){
    // end helper functions
    window.double_bars = {
	getChartDimensions: function(graph){
	    if (!graph.id) throw "Graph requires an ID"; 
	    
	    var width = utils.widthCalc(graph.id);
	    var height = utils.heightCalc(graph.id);
	    var margin = {top: (0.04*height), right: (0.03125*width), bottom: (0.06*height), left: (0.04166*width)};
	    
	    graph.margin= margin;
	    graph.width= width - margin.left - margin.right;
	    graph.height= height - margin.top - margin.bottom;

	    graph.midPoint = graph.width / 2;
	    graph.y = d3.scaleBand().rangeRound([graph.height,0]).paddingInner(0.2);
	    
	    graph.xRight = d3.scaleLinear();
	    graph.xLeft = d3.scaleLinear();
	    
	    if(graph.svg) d3.select('#'+graph.id).select('svg').remove();
	    graph.svg = d3.select('#'+graph.id).append('svg').attr('width', width).attr('height', height);
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
	    graph.data = data;

	    graph.keys = Object.keys(data[0]);

	    graph.y.domain(graph.data.map(function(d){return d.name}));

	    if(!graph.svg) throw "Graph requires to be generated before using the load function";
	    
	    if(graph.chart) {
		graph.chart.transition().duration(350)
		    .style('opacity',0)
		    .on('end',function(){
			graph.chart.remove();
			createGraph('col1');
		    })
	    }else{
		createGraph('col1');
	    }

	    function createGraph(column){
		graph.chart = graph.svg.append('g')
		    .attr('transform', utils.translation(graph.margin.left,graph.margin.top));

		// Append axis
		var yAxis = graph.chart.append('g').attr('class','y axis')
		    .style('text-anchor','middle')
		    .attr('id','y-axis');
		yAxis.call(d3.axisLeft(graph.y)).selectAll('line').remove();
		yAxis.selectAll('path').remove();
		yAxis.attr('transform', utils.translation(graph.midPoint,0));

		var labelsWidth = utils.getElemDim('y-axis','width');
		graph.startPointRight = graph.midPoint + labelsWidth/2;
		graph.startPointLeft = graph.midPoint - labelsWidth;
		
		graph.maxData = d3.max([
		    d3.max(graph.data, function(d){return d.col1}),
		    d3.max(graph.data, function(d){return d.col2})
		]);

		graph.xRight.rangeRound([0, graph.midPoint-(labelsWidth/2)])
		graph.xRight.domain([0, graph.maxData]);
		
		createRightBars();
		createLeftBars();

		function createLeftBars(){
		    var rBars = graph.chart.append('g').attr('class','double-bars left').selectAll('g')
			.data(graph.data).enter().append('g');
		    
		    rBars.append('rect')
			.style('fill', function(d, i) { return '#009cff'; })
			.attr('width', function(d){return graph.xRight(d['col2'])})
			.attr('height', graph.y.bandwidth())
			.attr('y', function(d,i) { return graph.y(d.name); })
			.attr('x', function(d) { return graph.startPointLeft-graph.xRight(d['col2'])});
		    
		    rBars.append('text')
			.attr("x", function(d) { return graph.startPointLeft-graph.xRight(d['col2'])+5})
			.attr("y", function(d) { return graph.y(d.name) + graph.y.bandwidth()/2 })
			.attr("dy", ".35em")
			.text(function(d) { return d3.format('.2%')(d['col2']); });
		};
		
		function createRightBars(){
		    var rBars = graph.chart.append('g').attr('class','double-bars right').selectAll('g')
			.data(graph.data).enter().append('g');
		    
		    rBars.append('rect')
			.style('fill', function(d, i) { return '#548000'; })
			.attr('width', function(d){return graph.xRight(d['col1'])})
			.attr('height', graph.y.bandwidth())
			.attr('y', function(d,i) { return graph.y(d.name); })
			.attr('x', function(d) { return graph.startPointRight;});
		    
		    rBars.append('text')
			.attr("x", function(d) { return graph.startPointRight + graph.xRight(d['col1'])-55 })
			.attr("y", function(d) { return graph.y(d.name) + graph.y.bandwidth()/2 })
			.attr("dy", ".35em")
			.text(function(d) { return d3.format('.2%')(d['col1']); });
		};
		
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
