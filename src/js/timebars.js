(function(){
    // end helper functions
    window.timebars = {
	getChartDimensions: function(graph){
	    if (!graph.id) throw "Graph requires an ID"; 
	    
	    var width = utils.widthCalc(graph.id);
	    var height = utils.heightCalc(graph.id);
	    var margin = {top: (0.05*height), right: (0.05*width), bottom: (0.08*height), left: (0.03*width)};
	    
	    graph.margin= margin;
	    graph.width= width-margin.left-margin.right;
	    graph.height= height-margin.top-margin.bottom;

	    graph.y = d3.scaleLinear().range([graph.height,0]);
	    graph.x = d3.scaleUtc().rangeRound([0, graph.width]);

	    graph.axis = {};
	    //graph.axis.x = d3.axisBottom().scale(graph.x).tickFormat(d3.timeFormat('%m')).ticks(36);
	    graph.axis.x = d3.axisBottom().scale(graph.x).tickFormat(d3.timeFormat('%B'));
	    graph.axis.y = d3.axisLeft().scale(graph.y).ticks(5)
	    
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
	    console.log(data);

	    graph.x.domain([d3.min(graph.data[graph.selector],function(d){return d[0]}),
			    d3.max(graph.data[graph.selector],function(d){return d[0]})]);
	    graph.y.domain([0,d3.max(graph.data[graph.selector],function(d){return d[1]})]);

	    // Calculate bar width
	    var padding = 0.005*graph.width;
	    var bar_width = (graph.width / graph.data[graph.selector].length) - 2*padding;

	    // Append axis
	    var xAxis = graph.chart.append('g').attr('class','timebars x axis')
		.attr('transform',utils.translation(0,graph.height))
		.call(graph.axis.x);
	    xAxis.selectAll('path').style('opacity',0);
	    var yAxis = graph.chart.append('g').attr('class','timebars y axis')
		.call(graph.axis.y);

	    // Draw year / month boxes
	    if(graph.drawYear){
		for(i = graph.x.domain()[0].getFullYear(); i <= graph.x.domain()[1].getFullYear(); i++){
		    var start = i == graph.x.domain()[0].getFullYear() ? graph.x.domain()[0]: new Date(i,0,1);
		    var end = i == graph.x.domain()[1].getFullYear() ? graph.x.domain()[1]: new Date(i,11,31);		    
		    if(i % 2 != 0){
			yAxis.append('rect')
			    .attr('y',0).attr('x',graph.x(start))
			    .attr('width', function(){
				if (i == graph.x.domain()[1].getFullYear()){
				    return graph.width - graph.x(start) + 1.5*bar_width;
				}else{
				    return graph.x(end) - graph.x(start);
				}
			    }).attr('height', graph.height)
			    .style('fill','grey').style('opacity',0.3)
		    };
		    
		}
	    }

	    // Draw bars
	    graph.chart.append('g')
		.attr('class','tb-bars')
		.selectAll('.bar')
		.data(graph.data[graph.selector]).enter().append('rect')
		.attr('class','bar')
		.attr('x',function(d){ return graph.x(d[0])+padding})
		.attr('y',function(d){ return graph.y(d[1]) })
		.attr('width',bar_width)
		.attr('height',function(d){ return graph.height - graph.y(d[1])})
		.style('stroke','rgb(178,74,52)')
		.style('fill',function(d,i) {return 'rgb(244,200,184)' })
		.on('click',function(d,i){console.log(d,i)});
	    
	    if(graph.drawYear){
		for(i = graph.x.domain()[0].getFullYear(); i <= graph.x.domain()[1].getFullYear(); i++){
		    if(i != graph.x.domain()[0].getFullYear()){
			var start = i == graph.x.domain()[0].getFullYear() ? graph.x.domain()[0]: new Date(i,0,1);
			var end = i == graph.x.domain()[1].getFullYear() ? graph.x.domain()[1]: new Date(i+1,0,1);
			graph.chart.append('text')
			    .attr('y', 0.1*graph.height)
			    .attr('x', function(d){
				var res = graph.x(new Date((start.getTime() + end.getTime())/2));
				if (i == graph.x.domain()[1].getFullYear()) res += 1.5*bar_width;
				return res;
			    }).attr("fill", "#000")
			    .text(i).style('font-size','200%').style('text-anchor','middle')
		    }
		}
	    };
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
