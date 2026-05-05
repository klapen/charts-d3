(function(){
    window.area = {
	getChartDimensions: function(graph){
	    if (!graph.id) throw "Graph requires an ID"; 
	    
	    var width = utils.widthCalc(graph.id);
	    var height = utils.heightCalc(graph.id);
	    var margin = {top: (0.05*height), right: (0.03*width), bottom: (0.06*height), left: (0.04*width)};
	    
	    graph.margin= margin;
	    graph.width= width - margin.left - margin.right;
	    graph.height= height - margin.top - margin.bottom;

	    graph.y = d3.scaleLinear().range([graph.height,0]);
	    graph.x = d3.scaleUtc().rangeRound([0, graph.width]);

	    graph.axis = {};
	    graph.axis.x = d3.axisBottom().scale(graph.x);
	    graph.axis.y = d3.axisLeft().scale(graph.y).ticks(5);

	    graph.area = d3.area().curve(d3.curveBasis)
		.x(function(d){ return graph.x(d[0])})
		.y1(function(d){ return graph.y(d[1])});
	    graph.color = d3.scaleQuantize()
		.range(["#a50026", "#d73027", "#f46d43", "#fdae61", "#fee08b", "#ffffbf",
			"#d9ef8b", "#a6d96a", "#66bd63", "#1a9850", "#006837"]);
	    
	    if(graph.svg) d3.select('#'+graph.id).select('svg').remove();
	     graph.svg = d3.select('#'+graph.id).append('svg')
		.attr('width', width).attr('height',height);
	    graph.chart = graph.svg.append('g')
		.attr('transform',utils.translation(margin.left,margin.top))
	},
	loadDataFromFile: function(graph,selector,url,callback){
	    var that = this;
	    graph.dataCallback = callback;
	    graph.selector = selector;
	    
	    var ext = url.split('.')[1];
	    if (ext == 'tsv'){
		d3.tsv(url, function(error, data) {
		    that.updateData(graph,data);
		});
	    }else if(ext == 'csv'){
		d3.csv(url, function(error, data) {
		    that.updateData(graph,data);
		}); 
	    }else if (ext == 'json'){
		d3.json(url, function(error, data) {
		    that.updateData(graph,data);
		});	    
	    }
	},
	updateData: function(graph,data){
	    var that = this;
	    graph.data = data;
	    var order_data = graph.dataCallback(data);

	    if(graph.chart) {
		graph.chart.transition().duration(350)
		    .style('opacity',0)
		    .on('end',function(){
			graph.chart.selectAll('g').remove();
			that.drawChart(graph,order_data);
			graph.chart.style('opacity',1);
		    })
	    }else{
		that.drawChart(graph,order_data);
	    };
	},
	drawChart: function(graph,data){
	    var that = this;
	    console.log(data);

	    graph.x.domain([d3.min(graph.data[graph.selector],function(d){return d[0]}),
			    d3.max(graph.data[graph.selector],function(d){return d[0]})]);
	    graph.y.domain([0,d3.max(graph.data[graph.selector],function(d){return d[1]})]);
	    graph.area.y0(graph.y(0));

	     // Append axis
	    var xAxis = graph.chart.append('g').attr('class','timebars x axis')
		.attr('transform',utils.translation(0,graph.height))
		.call(graph.axis.x);
	    xAxis.selectAll('path').style('opacity',0);
	    var yAxis = graph.chart.append('g').attr('class','timebars y axis')
		.call(graph.axis.y);

	    // Add gradient
	    graph.chart.append("linearGradient")
		.attr("id", "area-gradient")
		.attr("gradientUnits", "userSpaceOnUse")
		.attr("x1",0).attr("y1", graph.y(0))
		.attr("x2",0).attr("y2", graph.y(graph.y.domain()[1]))
		.selectAll("stop")
		.data([
		    {offset: "0%", color: "rgb(249,239,235)"},
		    {offset: "50%", color: "rgb(140,94,78)"},
		    {offset: "80%", color: "black"}
		]).enter().append("stop")
		.attr("offset", function(d) { return d.offset; })
		.attr("stop-color", function(d) { return d.color; });
	    
	    // Draw area
	    graph.chart.append('path')
	    	.datum(data[graph.selector])
		.attr('class','area')
	    	//.attr('fill','steelblue')
	    	.attr('d', graph.area);
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
