(function(){
    // end helper functions
    window.pack = {
	getChartDimensions: function(graph){
	    if (!graph.id) throw "Graph requires an ID"; 
	    
	    var width = utils.widthCalc(graph.id);
	    var height = utils.heightCalc(graph.id);
	    var margin = {top: (0.04*height), right: (0.03125*width), bottom: (0.06*height), left: (0.04166*width)};
	    
	    graph.margin= margin;
	    graph.width= width - margin.left - margin.right;
	    graph.height= height - margin.top - margin.bottom;

	    graph.color = d3.scaleOrdinal(d3.schemeCategory10);
	    graph.sankey = d3.sankey().nodeWidth(graph.width*0.015)
	        //.nodePadding(graph.height*0.02)
		.nodePadding(0)
		.extent([[1, 1], [graph.width - 1, graph.height - 6]]);
	    
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
	drawChart:function(chart,data){
	    chart.sankey(data);
	    
	    var link = chart.svg.append("g")
		.attr("class", "links")
		.attr("fill", "none")
		.attr("stroke", "#000")
		.attr("stroke-opacity", 0.2)
		.selectAll("path")
		.data(data.links).enter().append('path')
		.attr('d',d3.sankeyLinkHorizontal())
		.attr('stroke-width', function(d){return Math.max(1,d.width)});
	    link.append('title')
		.text(function(d){return d.source.name+" → "+d.target.name+"\n"+d.value});

	    var node = chart.svg.append("g")
		.attr("class", "nodes")
		.attr("font-family", "sans-serif")
		.attr("font-size", 10)
		.selectAll("g")
		.data(data.nodes).enter().append('g');

	    node.append("rect")
		.attr("x", function(d) { return d.x0; })
		.attr("y", function(d) { return d.y0; })
		.attr("height", function(d) { return d.y1 - d.y0; })
		.attr("width", function(d) { return d.x1 - d.x0; })
		.attr("fill", function(d) { return chart.color(d.name.replace(/ .*/, "")); })
		.attr("stroke", "#000");
	    
	    node.append("text")
		.attr("x", function(d) { return d.x0 - 6; })
		.attr("y", function(d) { return (d.y1 + d.y0) / 2; })
		.attr("dy", "0.35em")
		.attr("text-anchor", "end")
		.text(function(d) { return d.name; })
		.filter(function(d) { return d.x0 < chart.width / 2; })
		.attr("x", function(d) { return d.x1 + 6; })
		.attr("text-anchor", "start");
	    
	    node.append("title")
		.text(function(d) { return d.name + "\n" + d.value; });
	},
	updateData: function(graph,data){
	    var that = this;
	    graph.data = data;
	    var order_data = graph.dataCallback(data);
	    that.drawChart(graph,order_data[graph.selector]);
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
