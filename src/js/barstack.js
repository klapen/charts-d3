(function(){
    // end helper functions
    window.barstack = {
	getChartDimensions: function(graph){
	    if (!graph.id) throw "Graph requires an ID"; 
	    
	    var width = utils.widthCalc(graph.id);
	    var height = utils.heightCalc(graph.id);
	    var margin = {top: (0.05*height), right: (0.05*width), bottom: (0.05*height), left: (0.05*width)};
	    
	    graph.margin= margin;
	    graph.width= width;
	    graph.height= height;

	    graph.x = d3.scaleLinear().rangeRound([0,width-margin.left-margin.right]);
	    graph.y = d3.scaleBand().rangeRound([height-margin.top-margin.bottom,0])
		.paddingInner(0.05).align(0.1);
	    graph.color = d3.scaleOrdinal()
		.range(["#98abc5", "#8a89a6", "#7b6888", "#6b486b", "#a05d56", "#d0743c", "#ff8c00"]);

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
	    graph.chart = graph.svg.append('g').attr('transform',utils.translation(graph.margin.left,graph.margin.top));

	    console.log(data);

	    var keys = data.columns.slice(1);
	    graph.x.domain([0,d3.max(data,function(d){return d.total})]).nice();
	    graph.y.domain(data.map(function(d){return d.category}));
	    graph.color.domain(keys);
	    graph.stack.keys(keys);

	    graph.chart.selectAll('.serie')
		.data(graph.stack(data))
		.enter().append('g')
		.attr('class','serie').attr('fill', function(d){return graph.color(d.key)})
		.selectAll('rect')
		.data(function(d){ return d})
		.enter().append('rect')
		.attr("x", function(d) { return graph.x(d[0]); })
	    	.attr("y", function(d) { return graph.y(d.data.category); })
		.attr('class',function(d){ return d.data.category})
		.attr("height", graph.y.bandwidth())
	    	.attr("width", function(d) { return graph.x(d[1]) - graph.x(d[0]); });

	    graph.chart.append("g").attr("class", "axis axis--x")
		.attr("transform", utils.translation(0,graph.height-graph.margin.bottom-graph.margin.top))
		.call(d3.axisBottom(graph.x).ticks(5,'%'));

	    graph.chart.append("g")
		.attr("class", "axis axis--y")
		.call(d3.axisLeft(graph.y))
		.select('path').remove();

	    var legend = graph.chart.selectAll(".legend")
		.data(keys.reverse())
		.enter().append("g")
		.attr("class", "legend")
		.attr("transform", function(d, i) { return utils.translation(0,i * 20) })
		.style("font-size", "70%");

	    var chart_width = graph.width-graph.margin.left-graph.margin.right
	    
	    legend.append("rect")
		.attr("x", chart_width + 18)
		.attr("width", 18)
		.attr("height", 18)
		.attr("fill", graph.color);
	    
	    legend.append("text")
		.attr("x", chart_width + 44)
		.attr("y", 9)
		.attr("dy", ".35em")
		.attr("text-anchor", "start")
		.text(function(d) { return d; });
	    
	},
	updateData: function(graph,data){
	    var that = this;
	    graph.data = data;
	    var order_data = graph.dataCallback(data);
	    that.drawChart(graph,order_data);
	},
	onResize: function(graph){
	    this.getChartDimensions(graph);
	    this.updateData(graph,graph.data);
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
