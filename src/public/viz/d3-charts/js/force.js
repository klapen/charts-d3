(function(){
    // end helper functions
    window.force = {
	getChartDimensions: function(graph){
	    if (!graph.id) throw "Graph requires an ID"; 
	    
	    var width = utils.widthCalc(graph.id);
	    var height = utils.heightCalc(graph.id);
	    var margin = {top: (0.05*height), right: (0.05*width), bottom: (0.05*height), left: (0.05*width)};
	    
	    graph.margin= margin;
	    graph.width= width - margin.left - margin.right;
	    graph.height= height - margin.top - margin.bottom;

	    graph.r = d3.scaleLinear();
	    graph.color = d3.scaleOrdinal()
		.range(["#98abc5", "#8a89a6", "#7b6888", "#6b486b", "#a05d56", "#d0743c", "#ff8c00"]);
  
	    if(graph.svg) d3.select('#'+graph.id).select('svg').remove();
	    graph.svg = d3.select('#'+graph.id).append('svg')
		.attr('width', width).attr('height', height);
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
	    var keys = data[graph.selector].map(function(d){return d.name});
	    graph.color.domain(keys);

	    var radius = (graph.width < graph.height ? graph.width : graph.height) / 3;
	    graph.r.rangeRound([0,radius])
		.domain([0,d3.max(data[graph.selector],function(d){return d.value})])
	    
	    d3.forceSimulation(data[graph.selector])
		.force('charge', d3.forceManyBody().strength(5))
		.force('center', d3.forceCenter(graph.width / 2, graph.height / 2))
		.force('x',d3.forceX().x(graph.width/2))
		.force('y',d3.forceY().y(graph.height/2))
		.force('collision', d3.forceCollide().radius(function(d) { return graph.r(d.value) }))
		.on('tick',function(d){
		    var u = graph.chart.selectAll('circle').data(data[graph.selector])
		    
		    u.enter().append('circle')
			.attr('r', function(d){ return graph.r(d.value)})
			.merge(u)
			.attr('cx', function(d) { return d.x })
			.attr('cy', function(d) { return d.y })
			.style('fill',function(d) { return graph.color(d.name)})
		    
		    u.exit().remove()
		});
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
