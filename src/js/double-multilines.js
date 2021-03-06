(function(){
    // end helper functions
    window.doubleMultilines = {
	getChartDimensions: function(graph){
	    if (!graph.id) throw "Graph requires an ID"; 
	    
	    var width = utils.widthCalc(graph.id);
	    var height = utils.heightCalc(graph.id);
	    var margin = {top: (0.05*height), right: (0.08*width), bottom: (0.2*height), left: (0.15*width)};
	    
	    graph.margin= margin;
	    graph.width= width-margin.left-margin.right;
	    graph.height= height-margin.top-margin.bottom;

	    graph.y = d3.scaleLinear().range([0,graph.height/2]);
	    graph.yBottom = d3.scaleLinear().range([graph.height/2,0]);

	    graph.x = d3.scaleBand().rangeRound([graph.width,0]).paddingInner(0.2);
	    graph.color = d3.scaleOrdinal().range(["steelblue", "green", "#5fbee8", "#1062a3",
						   "#2aa8e0", "#1673b2", "#2396d1", "#1d85c2", "#cae9f7"]);
	    graph.valueLine = d3.line()
		.x(function(d) { return graph.x(d.x); })
		.y(function(d) { return graph.y(d.y); });
	    graph.valueLineBottom = d3.line()
		.x(function(d) { return graph.x(d.x); })
		.y(function(d) { return graph.yBottom(d.y); });
	    
	    if(graph.svg) d3.select('#'+graph.id).select('svg').remove();
	    graph.svg = d3.select('#'+graph.id).append('svg')
		.attr('width', width).attr('height',height);
	    graph.chart = graph.svg.append('g')
		.attr('transform',utils.translation(margin.left,margin.top))
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
	    var y_max = d3.max(graph.selector.lines.upper.reduce(function(acc,curr){
		acc = acc.concat(d3.extent(data,function(d){return d[curr]}));
		return acc;
	    },[]));
	    var y_max_bottom = d3.max(graph.selector.lines.bottom.reduce(function(acc,curr){
		acc = acc.concat(d3.extent(data,function(d){return d[curr]}));
		return acc;
	    },[]));
	    
	    var keys = data.map(function(d){ return d[graph.selector.x]}).sort(d3.descending)
	    graph.x.domain(keys);
	    graph.color.domain(Array.apply(null,{length:graph.selector.lines.upper.lenght}).map(Number.call, Number));
	    graph.y.domain([1.117*y_max,0]);
	    graph.yBottom.domain([1.117*y_max,0]);

	    graph.xAxis = graph.chart.append("g")
		.attr("class", "axis axis--x")
		.attr("transform", utils.translation(0, graph.height / 2 ))
		.call(d3.axisBottom(graph.x))

	    graph.yAxis = graph.chart.append("g")
		.attr("class", "axis axis--y")
	     graph.yAxisBottom = graph.chart.append("g")
		.attr("class", "axis axis--y axis-bottom")
		.attr('transform',utils.translation(0,graph.height/2))
	    
	    var axis = d3.axisLeft(graph.y);
	    var axisBottom = d3.axisLeft(graph.yBottom);
	    if(graph.format){
		axis.tickFormat(graph.format);
		axisBottom.tickFormat(graph.format);
	    }
	    graph.yAxis.call(axis);
	    graph.yAxisBottom.call(axisBottom);

	    if(graph.titles){
		if(graph.titles.x){
		    graph.xAxis.append("text")
	    		.attr("x", graph.width)
			.attr("y", -0.005*graph.width)
			.attr('text-anchor','end')
			.attr("font-size", "100%")
			.attr("fill", "#000")
			.text(graph.titles.x);
		}

		if(graph.titles.y){
		    graph.yAxis.append("text")
			.attr("transform", "rotate(-90)")
			.attr("y", 0.05*graph.width)
			.attr("font-size", "100%")
			.attr("fill", "#000")
			.text(graph.titles.y);
		}
		
		if(graph.titles.yBottom){
		    graph.yAxisBottom.append("text")
			.attr("transform", "rotate(-90)")
			.attr("y", 0.05*graph.width)
			.attr("font-size", "100%")
			.attr("fill", "#000")
			.text(graph.titles.yBottom);
		}
	    }

	    var lines_data = graph.selector.lines.upper.map(function(l){
		return {
		    'id': l,
		    'values': data.map(function(d){
			return {'x':d[graph.selector.x],'y':d[l]}
		    })
		}
	    },{})
	    var lines_data_bottom = graph.selector.lines.bottom.map(function(l){
		return {
		    'id': l,
		    'values': data.map(function(d){
			return {'x':d[graph.selector.x],'y':d[l]}
		    })
		}
	    },{})
	    
	    var lines = graph.chart.selectAll('.multilines-upper')
		.data(lines_data)
		.enter().append('g').attr('class','multilines-upper')
		.attr('transform',utils.translation(graph.x.bandwidth()/2,0))

	    lines.append('path').attr('class','mline')
		.attr('d',function(d){ return graph.valueLine(d.values) })
		.style('stroke', function(d,i){ return graph.color(i)})
		.style('fill','none').style('stroke-width', 0.001*graph.width);

	    var lines_bottom = graph.chart.selectAll('.multilines-bottom')
		.data(lines_data_bottom)
		.enter().append('g').attr('class','multilines-bottom')
		.attr('transform',utils.translation(graph.x.bandwidth()/2,0))

	    lines_bottom.append('path').attr('class','mline')
		.attr('d',function(d){ return graph.valueLineBottom(d.values) })
		.attr('transform',utils.translation(0,graph.height/2))
		.style('stroke', function(d,i){ return graph.color(i)})
		.style('fill','none').style('stroke-width', 0.001*graph.width);

	    var dots = graph.chart.append('g').attr('class','dots').selectAll('.mdot')
		.data(data).enter().append('g')
		.attr('transform',utils.translation(graph.x.bandwidth()/2,0));
	    
	    var tooltip = graph.chart.select('.dots').append('g')
		.attr('transform',utils.translation(graph.x.bandwidth()/2,0))
		.attr('class','mtooltip');

	    var radius = 0.01*graph.height;
	    function mouseover(n){
		var that = this;
		console.log('tool',d3.selectAll('.mdot-'+graph.id+'-'+n[graph.selector.x]).data())
		tooltip.selectAll('g').remove();
		var g = tooltip.selectAll('g')
		    .data(d3.selectAll('.mdot-'+graph.id+'-'+n[graph.selector.x]).data())
		    .enter().append('g');

		graph.selector.lines.upper.forEach(function(l){
		    g.append('text')
			.attr('x',function(d){ return graph.x(d[graph.selector.x])+2*radius})
			.attr('y',function(d){return graph.y(d[l]) - 2*radius})
			.style('text-anchor','middle').style('font-size','65%')
			.text(function(d){return graph.format ? graph.format(d[l]) : d[l]})
		    
		    g.append('line')
		    	.attr('x1',function(d){ return graph.x(d[graph.selector.x])})
		    	.attr('y1',function(d){ return graph.y(d[l])})
		    	.attr('x2',function(d){ return graph.x(d[graph.selector.x])})
		    	.attr('y2',function(d){ return graph.height/2 })
		    	.style('stroke','black').style('stroke-width',0.001*graph.width)
			.style('opacity',1)
		    	.attr('stroke-dasharray','5,10');
		    
		    g.append('line')
		    	.attr('x1',function(d){ return -graph.x.bandwidth()/2})
		    	.attr('y1',function(d){ return graph.y(d[l])})
		    	.attr('x2',function(d){ return graph.x(d[graph.selector.x])})
		    	.attr('y2',function(d){ return graph.y(d[l]) })
		    	.style('stroke','black').style('stroke-width',0.001*graph.width)
			.style('opacity',1)
		    	.attr('stroke-dasharray','5,10');
		})
		graph.selector.lines.bottom.forEach(function(l){
		    g.append('text')
			.attr('transform',utils.translation(0,graph.height/2))
			.attr('x',function(d){ return graph.x(d[graph.selector.x])+2*radius})
			.attr('y',function(d){return graph.yBottom(d[l]) - 2*radius})
			.style('text-anchor','middle').style('font-size','65%')
			.text(function(d){return graph.format ? graph.format(d[l]) : d[l]})
		    
		    g.append('line')
			.attr('transform',utils.translation(0,graph.height/2))
		    	.attr('x1',function(d){ return graph.x(d[graph.selector.x])})
		    	.attr('y1',0)
		    	.attr('x2',function(d){ return graph.x(d[graph.selector.x])})
		    	.attr('y2',function(d){ return graph.yBottom(d[l])})
		    	.style('stroke','black').style('stroke-width',0.001*graph.width)
			.style('opacity',1)
		    	.attr('stroke-dasharray','5,10');
		    
		    g.append('line')
		    	.attr('transform',utils.translation(0,graph.height/2))
		    	.attr('x1',function(d){ return -graph.x.bandwidth()/2})
		    	.attr('y1',function(d){ return graph.yBottom(d[l])})
		    	.attr('x2',function(d){ return graph.x(d[graph.selector.x])})
		    	.attr('y2',function(d){ return graph.yBottom(d[l]) })
		    	.style('stroke','black').style('stroke-width',0.001*graph.width)
		    	.style('opacity',1)
		    	.attr('stroke-dasharray','5,10');
		})
	    }
	    
	    graph.selector.lines.upper.forEach(function(l,i){
	    	dots.append('circle')
	    	    .attr('r',radius)
	    	    .attr('class',function(d){return 'mdot-upper mdot-'+graph.id+'-'+d[graph.selector.x]})
	    	    .attr('cx',function(d){ return graph.x(d[graph.selector.x])})
	    	    .attr('cy',function(d){ return graph.y(d[l])})
	    	    .style('fill',function(){ return graph.color(i)})
	    	    .on('mouseover',mouseover)
	    	    .on('click',mouseover);
	    });
	    graph.selector.lines.bottom.forEach(function(l,i){
		dots.append('circle')
		    .attr('r',radius)
		    .attr('transform',utils.translation(0,graph.height/2))
		    .attr('class',function(d){return 'mdot-bottom mdot-'+graph.id+'-'+d[graph.selector.x]})
		    .attr('cx',function(d){ return graph.x(d[graph.selector.x])})
		    .attr('cy',function(d){ return graph.yBottom(d[l])})
		    .style('fill',function(){ return graph.color(i)})
		    .on('mouseover',mouseover)
		    .on('click',mouseover);
	    })

	    // Conventions
	    var rect_size = graph.width*0.02;
	    var rect_gap = graph.width/graph.selector.lines.upper.length;
	    var conv = graph.chart.append('g').selectAll('g').data(graph.selector.lines.upper)
		.enter().append('g');
	    conv.append("rect")
		.attr('height',rect_size).attr('width',rect_size)
		.attr("x", function(d,i) { return rect_gap*i + rect_gap/8})
		.attr("y", 1.07*graph.height)
		.style("fill", function(d,i) { return graph.color(i); })
	    conv.append('text')
		.attr("x", function(d,i) { return rect_gap*i + rect_gap/8 + 2*rect_size})
		.attr("y", 1.07*graph.height +rect_size/2)
		.attr("dy", ".35em")
		.style("font", "sans-serif")
		.style('font-size','70%')
		.style("text-anchor", "start")
		.text(function(d) { return graph.labels ? graph.labels[d] : d; });
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
