(function(){
    window.loadmap = {
	loadMap: function(graph,assets,map_file){
	    if(!assets) throw "Maps assets directory is required"
	    if(!map_file) throw "First map file is required"
	    if(!graph.id) throw "Graph requires an ID";

	    var that = this;
	    graph.assets = assets;
	    graph.map_file = map_file;
	    
	    d3.xml(graph.assets+'/'+graph.map_file).mimeType('image/svg+xml').get(function(error, xml) {
		if (error) throw 'Load map error:'+ error;

		if(document.getElementById(graph.id).innerHTML != ''){
		    d3.select('#'+graph.id).transition().delay(500)
			.style('opacity',0)
			.on('end',function(){ load(graph.assets+'/'+graph.map_file); });
		}else{
		    load(graph.assets+'/'+graph.map_file);
		};
		
		function load(url){
		    document.getElementById(graph.id).innerHTML = '';
		    document.getElementById(graph.id).appendChild(xml.documentElement);
		    graph.map = d3.select('#'+graph.id).selectAll('svg');
		    graph.map.attr('width',graph.width).attr('height',graph.height);
		    graph.map.selectAll('path').on('click',function(){graph.mapClick(this)});
		    d3.select('#'+graph.id).transition().delay(500).style('opacity',1);
		};
	    });
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

            graph.margin= margin;
            graph.width= width - margin.left - margin.right;
            graph.height= height - margin.top - margin.bottom;

	    graph.mapClick = function(elem){
		if(elem.id.split('-')[1].length == 2){
		    col_map.loadMap(graph,graph.assets,elem.id+'.svg');
		}else{
		    graph.map.selectAll('path').classed('selected',false);
		    d3.select(elem).classed('selected',true);
		}
	    };
        },
    }
})();
