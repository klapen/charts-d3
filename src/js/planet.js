(function(){
    // end helper functions
    window.barstack = {
	getChartDimensions: function(graph){
	    if (!graph.id) throw "Graph requires an ID"; 
	    
	    var width = utils.widthCalc(graph.id);
	    var height = utils.heightCalc(graph.id);
	    var margin = {top: (0.05*height), right: (0.08*width), bottom: (0.05*height), left: (0.08*width)};
	    
	    graph.margin= margin;
	    graph.width= width-margin.left-margin.right;
	    graph.height= height-margin.top-margin.bottom;

	    graph.x = d3.scaleBand().rangeRound([0,graph.width*0.9]);
	    graph.r = d3.scaleLinear();
	    graph.color = d3.scaleOrdinal()
		.range(["#98abc5", "#8a89a6", "#7b6888", "#6b486b", "#a05d56", "#d0743c", "#ff8c00"]);
	    
	    if(graph.svg) d3.select('#'+graph.id).select('svg').remove();
	    graph.svg = d3.select('#'+graph.id).append('svg')
		.attr('width', graph.width).attr('height', graph.height);
	    graph.chart = graph.svg.append('g').attr('transform',utils.translation(margin.left,margin.top))
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
	    graph.data = data;
	    var keys = data[graph.selector].map(function(d){return d.name});

	    graph.x.domain(keys);
	    graph.color.domain(keys);
	    graph.r.rangeRound([0,graph.x.bandwidth()])
		.domain([0,d3.max(data[graph.selector],function(d){return d.value})])

	    var dots = graph.chart.selectAll('.data-dots')
		.data(data[graph.selector]).enter().append('g')
		.attr('class','data-dots');

	    dots.append('circle')
		.attr('cx',function(d){return graph.x(d.name)})
		.attr('cy',graph.x.bandwidth())
		.attr('r',function(d){return graph.r(d.value)})
		.style('fill',function(d){return graph.color(d.name)});

	    var y_offset = (graph.height-graph.x.bandwidth())/2;

	    dots.append('line')
		.attr('x1',function(d){return graph.x(d.name)})
		.attr('y1',function(d){return (1.05*graph.x.bandwidth()) + graph.r(d.value)})
		.attr('x2',function(d){return graph.x(d.name)})
		.attr('y2',function(d,i){ return graph.height - (i % 2 == 0 ? y_offset/2 : y_offset); })
		.style('stroke','#5cb3e6').style('stroke-width',1);

	    dots.append('text')
	    	.attr('x',function(d){return graph.x(d.name)})
		.attr('y',function(d,i){ return graph.height + (0.15*graph.x.bandwidth()) - (i % 2 == 0 ? y_offset/2 : y_offset); })
		.style('text-anchor','middle').style('font-size','80%')
		.text(function(d){return d.name})

	    
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
