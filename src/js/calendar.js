(function(){
    window.calendar = {
	getChartDimensions: function(graph){
	    if (!graph.id) throw "Graph requires an ID"; 
	    
	    var width = utils.widthCalc(graph.id);
	    var height = utils.heightCalc(graph.id);
	    var margin = {top: (0.05*height), right: (0.03*width), bottom: (0.06*height), left: (0.04*width)};
	    
	    graph.margin= margin;
	    graph.width= width - margin.left - margin.right;
	    graph.height= height - margin.top - margin.bottom;
	    graph.cellSize = graph.width/53;
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
	    var yr = graph.chart.selectAll('g').data([2018]).enter().append('g')

	    // Draw grid
	    yr.append('text')
		.attr("transform", "translate(-6," + graph.cellSize * 3.5 + ")rotate(-90)")
		.style("text-anchor", "middle")
		.text(function(d) { return d; });
	    
	    var day = yr.append('g').attr('class','calendar-days').selectAll('.calendar-day')
		.data(function(d){return d3.timeDays(new Date(d,0,1),new Date(d+1,0,1))})
		.enter().append('rect')
		.attr('id',function(d){ return 'cal-day-'+d.getFullYear()+'-'+d.getMonth()+'-'+d.getDate()})
		.attr('class','calendar-day')
		.attr('width',graph.cellSize).attr('height',graph.cellSize)
		.attr("x", function(d) { return d3.timeWeek.count(d3.timeYear(d), d) * graph.cellSize; })
		.attr("y", function(d) { return d.getDay() * graph.cellSize; })

	    var month = yr.selectAll('.calendar-month')
		.data(function(d) { return d3.timeMonths(new Date(d, 0, 1), new Date(d + 1, 0, 1)); })
		.enter().append("g")
		.attr("class", "calendar-month")
	    month.append('path')
		.attr("d", monthPath);
	    var months_names = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
	    month.append('text')
		.attr('y',function(){ return 1.05*this.parentElement.getBoundingClientRect().height})
		.attr('x',function(){ return this.parentElement.getBoundingClientRect().x})
		.attr("fill", "#000")
		.style('font-size','70%').style('text-anchor','middle')
		.text(function(d){ return months_names[d.getMonth()]; })

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

	    // Heap map
	    graph.color.domain([0,d3.max(data[graph.selector],function(d){ return d[1]})])
	    data[graph.selector].map(function(val){
		d3.select('#cal-day-'+val[0].getFullYear()+'-'+val[0].getMonth()+'-'+val[0].getDate())
		    .attr('fill',graph.color(val[1]))
	    })

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
