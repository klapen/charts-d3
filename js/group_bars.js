(function(){
    window.group_bars = {
	getChartDimensions: function(graph){
	    if (!graph.id) throw "Graph requires an ID";
	    
	    var width = utils.widthCalc(graph.id);
	    var height = utils.heightCalc(graph.id);
	    var margin = {top: (0.04*height), right: (0.03125*width), bottom: (0.06*height), left: (0.05*width)};
	    
	    graph.margin= margin;
	    graph.width= width - margin.left - margin.right;
	    graph.height= height - margin.top - margin.bottom;
	    
	    graph.x = d3.scaleLinear().rangeRound([0,graph.width]);
	    graph.y0 = d3.scaleBand().rangeRound([graph.height,0]).paddingInner(0.2);
	    graph.y1 = d3.scaleBand().padding(0.1);
	    graph.z = d3.scaleOrdinal()
		.range(["#98abc5", "#8a89a6", "#7b6888", "#6b486b", "#a05d56", "#d0743c", "#ff8c00"]);

	    if(graph.svg) d3.select('#'+graph.id).select('svg').remove();
	    graph.svg = d3.select('#'+graph.id).append('svg');
	    
	    graph.svg.attr('width', graph.width + graph.margin.left + graph.margin.right)
		.attr('height', graph.height + graph.margin.top + graph.margin.bottom)

	},
	onResize: function(graph){
	    this.getChartDimensions(graph);
	    this.updateData(graph.data,graph);
	},
	loadData: function(graph,data){
	    graph.data = data;
	    
	    var bars = graph.data[0].value.length;
	    graph.keys = Object.keys(graph.data[0].value);

	    graph.y0.domain(data.map(function(d){return d.name}));
	    graph.y1.domain(graph.keys).rangeRound([0, graph.y0.bandwidth()])

	    var domain = graph.data.reduce(function(acc,curr){
		var max = d3.max(Object.values(curr.value));
		if (max > acc) acc = max;
		return acc;
	    }, Number.MIN_SAFE_INTEGER);
	    graph.x.domain([0,domain]);

	    if(!graph.svg) throw "Graph requires to be generated before using the load function";
	    if(graph.chart) {
		graph.chart.transition().duration(350)
		    .style('opacity',0)
		    .on('end',function(){
			graph.chart.remove();
			createGraph();
		    })
	    }else{
		createGraph();
	    }

	    function createGraph(){
		
		graph.chart = graph.svg.append('g')
		    .attr('transform', utils.translation(graph.margin.left,graph.margin.top));

		var groups = graph.chart.append('g').selectAll('g')
		    .data(graph.data)
		    .enter().append('g')
		    .attr('transform', function(d, i) { return 'translate(0,' + graph.y0(d.name)+')'; })
		var bars = groups.selectAll('rect')
		    .data(function(d) {
			return graph.keys.map(function(key) { return {key: key, value: d.value[key]}; });
		    }).enter().append('rect')
	    	    .style('fill', function(d, i) { return graph.z(i); })
		    .attr('width', function(d){return graph.x(d.value)})
		    .attr('height', graph.y1.bandwidth())
		    .attr('y', function(d,i) { return graph.y1(d.key); })
		    .attr('x', function(d) { return 0;});

		graph.chart.append('g')
		    .attr('class', 'x axis')
	    	    .attr('transform', 'translate(0,' + graph.height + ')')
		    .call(d3.axisBottom(graph.x).tickSize(-graph.height));
		
		graph.chart.append('g')
		    .attr('class', 'y axis')
		    .call(d3.axisLeft(graph.y0));
		
		groups.selectAll('text')
		    .data(function(d) {
			return graph.keys.map(function(key) { return {key: key, value: d.value[key]}; });
		    }).enter().append('text')
		    .attr("x", function(d) { return graph.x(d.value)-20;  })
		    .attr("y", function(d) { return graph.y1(d.key) +(graph.y1.bandwidth()/2); })
		    .attr("dy", ".35em")
		    .text(function(d) { return d.value; });

		var legend = graph.chart.append("g")
		    .attr("font-family", "sans-serif")
		    .attr("font-size", 10)
		    .attr("text-anchor", "end")
		    .selectAll("g")
		    .data(graph.keys.slice().reverse())
		    .enter().append("g")
		    .attr("transform", function(d, i) { return "translate(0," + i * 20 + ")"; });
		
		legend.append("rect")
		    .attr("x", graph.width - 25)
		    .attr("width", 19)
		    .attr("height", 19)
		    .attr("fill", graph.z);
		
		legend.append("text")
		    .attr("x", graph.width - 30)
		    .attr("y", 9.5)
		    .attr("dy", "0.32em")
		    .text(function(d) { return d; });
	    };
	},
	generate: function(id,data){
	    var that = this;
	    var graph = {id:id};
	    
	    this.getChartDimensions(graph);
	    
	    window.onresize = function(){that.onResize(graph);}
	    return graph;
	}
    }
})();
