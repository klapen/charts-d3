var oas;
document.addEventListener('DOMContentLoaded', function(event) {
    // load double bar
    pChart = pack.generate('sankey-chart');
    oas = pChart;
    pack.loadDataFromFile(pChart,'Segment 1','data/sankey.csv',function(data){
	var sankey_obj = {'nodes':['First','Second','Third','Fourth','Fifth','With','Without'],
			   'links':[]};
	var res = {};
	data.map(function(d){
	    res[d.name] = JSON.parse(JSON.stringify(sankey_obj));
	    res[d.name].nodes.map(function(n,i){
		if(n != 'With' && n != 'Without'){
		    var t = +d[n.toLowerCase()+'_t'];
		    res[d.name].links.push({'source':i,'target':5,'value':t})
		    res[d.name].links.push({'source':i,'target':6,'value':+d[n.toLowerCase()]-t})
		};
		res[d.name].nodes[i] = {'name':n}
	    });
	    
	})
	return res;
    });
})
