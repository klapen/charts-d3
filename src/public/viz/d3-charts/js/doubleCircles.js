(function(){
    // end helper functions
    window.doubleCircles = {
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
		.range(["#023f85", "#95d3f0", "red", "green"]);
	    
	    if(graph.svg) d3.select('#'+graph.id).select('svg').remove();
	    graph.svg = d3.select('#'+graph.id).append('svg')
		.attr('width', width).attr('height',height);
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
	    var keys = data[graph.selector].data.map(function(d){return d.name});
	    var selectors = Object.keys(data);

	    graph.x.domain(keys);
	    graph.color.domain(selectors);
	    var max_data = {};
	    graph.r.rangeRound([0,graph.x.bandwidth()])
		.domain([0,d3.max(selectors,function(s){
		    return data[s].data.reduce(function(acc,curr){
			if(!max_data[curr.name]) max_data[curr.name] = -1;
			max_data[curr.name] = curr.value > max_data[curr.name] ? curr.value : max_data[curr.name];
			acc = curr.value > acc ? curr.value : acc;
			return acc;
		    },-1)
		})])

	    var dots = graph.chart.append('g').attr('class','data-dots');

	    var tooltip = graph.chart.append('g').attr('class','tooltip-double-circles tooltip-'+graph.id);

	    function mouseover(d,i){
		tooltip.selectAll('text').remove();
		var m_data = d3.selectAll('.data-dots-'+d.name).data();
		tooltip.selectAll('text').data(m_data).enter().append('text')
		    .attr('x',function(){return graph.x(d.name)})
		    .attr('y',function(e,j){
			var offset = i % 2 == 0 ? y_offset/2 : y_offset;
			return graph.height + (0.5*graph.x.bandwidth()) - offset + (j*0.25*graph.x.bandwidth());
		    }).text(function(e){return e.year+": "+d3.format('.1%')(e.value/100)})
		    .style('text-anchor','middle').style('font-size','60%');
		tooltip.transition().duration(200)
		    .style('opacity',0.9);
	    };
	    function mouseout(d){tooltip.transition().duration(200).style('opacity',0)}
	    
	    Object.keys(data).forEach(function(k){ drawCircles(k,data[k].data); })
	    function drawCircles(sel,datum){
		var yr = dots.append('g').selectAll('g')
		    .data(datum).enter().append('g')
		    .attr('class',function(d){return 'data-dots-'+d.name});
		
		yr.append('circle')
		    .attr('cx',function(d){return graph.x(d.name)})
		    .attr('cy',graph.x.bandwidth())
		    .attr('r',function(d){
			var min_radius = 0.1*graph.r.domain()[1];
			if(d.value < min_radius) return graph.r(min_radius)
			else return graph.r(d.value)
		    })
		    .attr('year',sel)
		    .style('fill','none')
		    .style('stroke',function(d){return graph.color(sel)})
		    .style('stroke-width',2);
	    }
	    
	    var y_offset = (graph.height-graph.x.bandwidth())/2;

	    var lines = graph.chart.append('g').attr('class','data-lines')
		.selectAll('g')
		.data(data[graph.selector].data).enter().append('g');
	    
	    lines.append('line')
		.attr('x1',function(d){return graph.x(d.name)})
		.attr('y1',function(d){
		    var rad = max_data[d.name]
		    var min_radius = 0.1*graph.r.domain()[1];
		    if(rad < min_radius) rad = min_radius;
		    return (1.05*graph.x.bandwidth()) + graph.r(rad)
		})
		.attr('x2',function(d){return graph.x(d.name)})
		.attr('y2',function(d,i){ return graph.height - (i % 2 == 0 ? y_offset/2 : y_offset); })
		.style('stroke','#5cb3e6').style('stroke-width',1);

	    lines.append('text')
	    	.attr('x',function(d){return graph.x(d.name)})
		.attr('y',function(d,i){
		    return graph.height + (0.15*graph.x.bandwidth()) - (i % 2 == 0 ? y_offset/2 : y_offset);
		}).style('text-anchor','middle').style('font-size','70%')
		.text(function(d){return d.name})
		.on('mouseover',mouseover).on('mouseout',mouseout)
		.on('click',mouseover)

	    lines.append('circle')
		.attr('cx',function(d){return graph.x(d.name)})
		.attr('cy',graph.x.bandwidth())
		.attr('r',function(d){
		    var rad = max_data[d.name]
		    var min_radius = 0.1*graph.r.domain()[1];
		    if(rad < min_radius) return graph.r(min_radius)
		    else return graph.r(rad)
		})
		.style('opacity',0).on('mouseover',mouseover).on('mouseout',mouseout)
		.on('click',mouseover)

	    // Conventions
	    var conv = graph.chart.append('g').attr('class','data-convention')
		.selectAll('g').data(selectors).enter().append('g');
	    var cr = 0.1*graph.x.bandwidth();
	    
	    conv.append('circle')
		.attr('cx',function(d,i){ return graph.x(keys.slice(-1)[0]) - (selectors.length-1-i)*9*cr })
		.attr('cy',graph.margin.top).attr('r', cr)
		.style('fill','none')
		.style('stroke',function(d){return graph.color(d)})
		.style('stroke-width',2);
	    conv.append('text')
		.attr('x',function(d,i){ return graph.x(keys.slice(-1)[0]) - (selectors.length-1-i)*9*cr + 1.4*cr})
		.attr('y',graph.margin.top+0.7*cr).attr('r', cr)
		.style('text-anchor','start').style('font-size','70%')
		.text(function(d){ return data[d].name});
	    
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
