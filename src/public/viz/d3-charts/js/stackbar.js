(function(){
    window.stackbar = {
	colors: {
            'cat1': '#e8457d',
            'cat2': '#339fe3',
            'cat3': '#db6a00',
            'cat4': '#bc6fae',
            'cat5': '#41ba8e'
	},
	generate: function(id){
	    var that = this;
            var graph = {id:id};
            this.getChartDimensions(graph);
            window.onresize = function(){that.onResize(graph);}
            return graph;
	},
	getChartDimensions: function(graph){
            if (!graph.id) throw "Graph requires an ID";

            var width = utils.widthCalc(graph.id);
            var height = utils.heightCalc(graph.id);
            var margin = {top: 20, right: 20, bottom: 20, left: 20};

	    graph.labelHeight = 25;
            graph.margin= margin;
            graph.width= width - margin.left - margin.right;
            graph.height= height - margin.top - margin.bottom;

	    graph.scale = d3.scaleLinear().range([0, graph.width]);

            if(graph.svg) d3.select('#'+graph.id).select('svg').remove();
            graph.svg = d3.select('#'+graph.id).append('svg').attr('width', graph.width).attr('height', graph.height);
        },
	updateData: function(graph,data){
	    if(!graph.svg) throw "Graph requires to be generated before using the update function";
	    var that = this;
	    var cats = graph.svg.selectAll('g')
	    cats.transition().duration(350)
		.style('opacity',0)
		.on('end',function(){
		    cats.remove();
		    that.loadData(graph,data);
		})
	},
	loadData: function(graph,data) {
	    var sum = data.reduce(function(acc, curr){
		curr.acc = acc;
		return curr.value + acc
	    }, 0);

	    graph.data = data;
	    graph.scale.domain([0, sum]);

	    var that = this;

	    var categories = graph.svg.selectAll('g').data(data).enter().append('g');
	    
	    var rects = categories.append('rect')
		.attr('height', graph.height)
		.attr('width', function(d) {return graph.scale(d.value) })
		.style('fill', function(d) {return that.colors[d.name] })
		.attr('x', function(d) { return graph.scale(d.acc) })
		.attr('transform', utils.translation(0, graph.labelHeight))
		.style('opacity',0)
	    	.transition().duration(750)
		.style('opacity',1);

	    categories.append('text')
		.style('dominant-baseline', 'auto')
		.style('font-size', '14px')
		.attr('x', function(d) {
		    return graph.scale(d.acc) + (graph.scale(d.value) / 2) })
		.attr('y', graph.height / 2)
		.attr('dy', '.35em')
		.text(function(d) { return d3.format(".2%")(d.value)})
		.attr('transform', utils.translation(0, graph.labelHeight))
		.style('opacity',0)
	    	.transition().duration(750)
		.style('opacity',1);
	}
    }
})()


