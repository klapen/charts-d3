(function(){
    // end helper functions
    window.analfabetismo = {
	getChartDimensions: function(graph){
	    if (!graph.id) throw "Graph requires an ID"; 
	    
	    var width = utils.widthCalc(graph.id);
	    var height = utils.heightCalc(graph.id);
	    var margin = {top: (0.04*height), right: (0.03125*width), bottom: (0.04*height), left: (0.04166*width)};
	    
	    graph.margin= margin;
	    graph.width= width - margin.left - margin.right;
	    graph.height= height - margin.top - margin.bottom;
	    
	    graph.y = d3.scaleBand().rangeRound([graph.height,0]).paddingInner(0.2);
	    
	    graph.xRight = d3.scaleLinear();
	    graph.xLeft = d3.scaleLinear();
	    
	    if(graph.svg) d3.select('#'+graph.id).select('svg').remove();
	    graph.svg = d3.select('#'+graph.id).append('svg').attr('width', width).attr('height', height);
	},
	// ToDo: Refactor on utils using callback
	loadDataFromFile: function(graph,selector,url,callback){
	    var that = this;
	    graph.selector = selector;
	    graph.dataCallback = callback || graph.dataCallback;
	    if(graph.dataCallback == undefined) throw "Graph requires a data callback";
	    
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
	    var that = this;
	    graph.chart = graph.svg.append('g').attr('transform',utils.translation(graph.margin.left,graph.margin.top));
	    var keys = data[graph.selector]['Female'].sort(function(a,b){return a.value - b.value})
		.map(function(d){return d.name});

	    var sum_male = d3.sum(data[graph.selector]['Male'],function(d){return d.value});
	    data[graph.selector]['Male'].map(function(d){ d.total = sum_male});
	    var sum_female = d3.sum(data[graph.selector]['Female'],function(d){return d.value});
	    data[graph.selector]['Female'].map(function(d){ d.total = sum_female});

	    graph.y.domain(keys);

	    graph.maxData = [
		d3.max(data[graph.selector]['Female'], function(d){return d.value/d.total}),
		d3.max(data[graph.selector]['Male'], function(d){return d.value/d.total})
	    ];
	    
	    // Calculate mid point
	    var right_col_per = graph.maxData[0]/(graph.maxData[1]+graph.maxData[0]);
	    var line_stroke = graph.width*0.002;
	    graph.midPoint = graph.width*right_col_per;

	    graph.xRight.rangeRound([0, graph.width-graph.midPoint-line_stroke])
	    graph.xRight.domain([0, graph.maxData[0]]);

	    graph.xLeft.rangeRound([0, graph.midPoint+line_stroke])
	    graph.xLeft.domain([0, graph.maxData[1]]);
	    
	    // Append x axis
	    // var xRightAxis = graph.chart.append('g').attr('class','x-right axis')
	    // 	.style('text-anchor','middle')
	    // 	.attr('id','xRight-axis');
	    // xRightAxis.call(d3.axisBottom(graph.xRight)
	    // 		    .tickValues(graph.xRight.ticks(4).concat(graph.xRight.domain()[1]))
	    // 		    .tickFormat(d3.format('.0%')));
	    // xRightAxis.attr("transform", utils.translation(graph.midPoint,graph.height));

	    // var xLeftAxis = graph.chart.append('g').attr('class','x-left axis')
	    // 	.style('text-anchor','middle')
	    // 	.attr('id','xLeft-axis');
	    // xLeftAxis.call(d3.axisBottom(graph.xLeft)
	    // 		   .tickValues(graph.xLeft.ticks(4).concat(graph.xLeft.domain()[1]))
	    // 		   .tickFormat(d3.format('.0%')));
	    // xLeftAxis.attr("transform", utils.translation(graph.midPoint,graph.height)+' scale(-1,1)');
	    // xLeftAxis.selectAll('line').style('visibility',function(d){return d == 0 ? 'hidden':''});
	    // xLeftAxis.selectAll('text')
	    // 	.attr('transform','scale(-1,1)')
	    // 	.text(function(d){return d == 0 ? '':d3.format('.0%')(d)});

	    // d3.selectAll('.axis text').style('font-size','70%');
	    
	    that.createRightBars(graph,data[graph.selector]['Female']);
	    that.createLeftBars(graph,data[graph.selector]['Male']);

	    // Middle line 
	    graph.chart.append('line').attr('class','analfabetismo-mid-line')
		.attr('x1',graph.midPoint).attr('y1',-graph.margin.top)
		.attr('x2',graph.midPoint).attr('y2',graph.height+graph.margin.bottom)
		.style('stroke','#000000').style('stroke-width',line_stroke)
	    
	},
	createLeftBars: function(graph,data){
	    var rBars = graph.chart.append('g').attr('class','male-bars left').selectAll('g')
		.data(data).enter().append('g');
	    
	    rBars.append('rect')
		.style('fill','#162a6b')
		.attr('class',function(d){return 'male-'+d.name.replace(/ /g,'-').toLowerCase()})
		.attr('width', function(d){return graph.xLeft(d.value/d.total)})
		.attr('height', graph.y.bandwidth())
		.attr('y', function(d,i) { return graph.y(d.name); })
		.attr('x', function(d) { return graph.midPoint-graph.xLeft(d.value/d.total)});
	    
	    // Add labels
	    rBars.append('text')
	    	.attr("x", function(d) { return graph.midPoint/2})
	    	.attr("y", function(d) { return graph.y(d.name)+graph.y.bandwidth()/2; })
	    	.attr("dy", ".35em")
	    	.style('text-anchor','middle')
	    	.text(function(d) { return d3.format('.2%')(d.value/d.total); })
		.style('fill',function(d){
		    return graph.midPoint/2 > graph.midPoint - graph.xLeft(d.value/d.total) ? 'white' : 'black'
		});
	},
	createRightBars: function(graph,data){
	    var rBars = graph.chart.append('g').attr('class','female-bars right').selectAll('g')
		.data(data).enter().append('g');
	    
	    rBars.append('rect')
		.style('fill', '#4496d8')
		.attr('class',function(d){return 'female-'+d.name.replace(/ /g,'-').toLowerCase()})
		.attr('width', function(d){return graph.xRight(d.value/d.total)})
		.attr('height', graph.y.bandwidth())
		.attr('y', function(d,i) { return graph.y(d.name); })
		.attr('x', function(d) { return graph.midPoint;});
	    
	    // Add labels
	    rBars.append('text')
	    	.attr("x", function(d) { return graph.midPoint + (graph.width-graph.midPoint)/2})
	    	.attr("y", function(d) { return graph.y(d.name)+graph.y.bandwidth()/2; })
	    	.attr("dy", ".35em")
		.style('text-anchor','middle')
	    	.text(function(d) { return d3.format('.2%')(d.value/d.total);})
		.style('fill',function(d){
		    var text_point = graph.midPoint + (graph.width-graph.midPoint)/2;
		    return text_point < graph.midPoint + graph.xRight(d.value/d.total) ? 'white' : 'black'
		});
	},
	updateData: function(graph,data){
	    var that = this;
	    graph.data = data;
	    var order_data = graph.dataCallback(data);
	    graph.svg.selectAll('g').remove();

	    if(!graph.svg) throw "Graph requires to be generated before using the load function";
	    
	    if(graph.chart) {
		graph.chart.transition().duration(350)
		    .style('opacity',0)
		    .on('end',function(){
			graph.chart.remove();
			that.drawChart(graph,order_data);
		    })
	    }else{
		that.drawChart(graph,order_data);
	    }	
	},
	onResize: function(graph){
	    this.getChartDimensions(graph);
	    this.updateData(graph,graph.data);
	},
	generate: function(id){
	    var that = this;
	    var graph = {id:id,
			 dataSelector: 'percentage'};
	    graph.changeDataSelector = function(selector){
		// ToDo: change to quantity
	    };
	    that.getChartDimensions(graph);
	    window.onresize = function(){that.onResize(graph)};
	    return graph;
	}
    }
})();
