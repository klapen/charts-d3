(function(){
    window.radialStackbar = {
	getChartDimensions: function(graph){
	    if (!graph.id) throw "Graph requires an ID"; 
	    
	    var width = utils.widthCalc(graph.id);
	    var height = utils.heightCalc(graph.id);
	    var margin = {top: (0.02*height), bottom: (0.02*height),
			  right: (0.02*width), left: (0.02*width)};
	    
	    graph.margin= margin;
	    graph.width= width - margin.left - margin.right;
	    graph.height= height - margin.top - margin.bottom;

	    graph.outerRadius = Math.min(graph.width,graph.height)/2;
	    graph.innerRadius = graph.outerRadius * 0.4;

	    graph.x = d3.scaleBand().range([0, 2 * Math.PI]).align(0);
	    graph.y = d3.scaleRadial().range([graph.innerRadius,graph.outerRadius]);

	    graph.color = d3.scaleOrdinal()
		.range(["#98abc5", "#8a89a6", "#7b6888", "#6b486b", "#a05d56", "#d0743c", "#ff8c00"]);
	    
	    if(graph.svg) d3.select('#'+graph.id).select('svg').remove();
	    graph.svg = d3.select('#'+graph.id).append('svg')
		.attr('width', width).attr('height',height);
	    graph.chart = graph.svg.append('g')
		.attr('transform',utils.translation(width/2,height/2))
	},
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
	    console.log('drawChart');
	    columns = data.columns.filter(function(c){ return c != 'name'});

	    graph.x.domain(data.map(function(d) { return d.name; }).reverse());
	    graph.y.domain([0, d3.max(data, function(d) { return d.total; })]);
	    graph.color.domain(columns);

	    graph.chart.append("g")
		.selectAll("g").data(d3.stack().keys(columns.reverse())(data))
		.enter().append("g")
		.attr("fill", function(d) { return graph.color(d.key); })
		.selectAll("path")
		.data(function(d) { return d; })
		.enter().append("path")
		.attr("d", d3.arc()
		      .innerRadius(function(d) { return graph.y(d[0]); })
		      .outerRadius(function(d) { return graph.y(d[1]); })
		      .startAngle(function(d) { return graph.x(d.data.name); })
		      .endAngle(function(d) { return graph.x(d.data.name) + graph.x.bandwidth(); })
		      .padAngle(0.01)
		      .padRadius(graph.innerRadius));

	    graph.labels = graph.chart.append("g")
		.selectAll("g")
		.data(data).enter().append("g")
		.attr("text-anchor", "middle")
		.attr("transform", function(d) {
		    return "rotate(" + ((graph.x(d.name) + graph.x.bandwidth() / 2) * 180 / Math.PI - 90) +
			")translate(" + graph.innerRadius + ",0)"; });
	    
	    graph.labels.append("line").attr("x2", -5)
		.attr("stroke", "#000");

	    var lbl_font_size = graph.outerRadius * 0.0623;
	    graph.labels.append("text")
		.attr("transform", function(d) {
		    return (graph.x(d.name) + graph.x.bandwidth() / 2 + Math.PI / 2) % (2 * Math.PI) < Math.PI ? "rotate(90)translate(0,"+(1.2*lbl_font_size)+")" : "rotate(-90)translate(0,"+(-0.56*lbl_font_size)+")"; })
		.style('font-size', lbl_font_size+'px')
		.text(function(d) { return d.name; });

	    var rect_size = graph.outerRadius * 0.1;
	    var legend_start = graph.height/2 - (rect_size*columns.length);
	    graph.legend = graph.chart.append("g")
		.selectAll("g")
		.data(columns.reverse()).enter().append("g")
		.attr("transform", function(d, i) {
		     return utils.translation(-graph.width /4 , legend_start + i * rect_size)		    
		});

	    graph.legend.append("rect")
		.attr("width", 0.8*rect_size).attr("height", 0.8*rect_size)
		.attr("fill", graph.color);
	    
	    graph.legend.append("text")
	     	.attr("x", 1.1*rect_size).attr("y", 0.4*rect_size)
	     	.attr("dy", "0.35em")
		.style('font-size',0.6*rect_size+'px')
	     	.text(function(d) { return d; });
	    
	},
	onResize: function(graph){
	    this.getChartDimensions(graph);
	    this.updateData(graph,graph.data);
	},
	generate: function(id){
	    var that = this;
	    var graph = {id:id};
	    var resize_id;
	    this.getChartDimensions(graph);
	    graph.resizeId = resize_id;
	    window.onresize = function(){
		clearTimeout(graph.resizeId);
		graph.resizeId = setTimeout(function(){
		    that.onResize(graph)
		}, 500);
	    };
	    return graph;
	}
    }
})();
