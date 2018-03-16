var oas;
document.addEventListener('DOMContentLoaded', function(event) {
    // Load horizontal group bars
    gbars = group_bars.generate('group-bars-chart');
    group_bars.loadData(gbars,[{'name':'Convocados','value':{'rol1':4,'rol2':5}},
			       {'name':'Inscritos','value':{'rol1':4,'rol2':5}},
			       {'name':'Requeridos','value':{'rol1':1,'rol2':2}}
			      ]);
    setTimeout(function(){
	// Load from data array
	group_bars.loadData(gbars,[{'name':'Convocados','value':{'rol1':30}},
				   {'name':'Inscritos','value':{'rol1':30}},
				   {'name':'Requeridos','value':{'rol1':15}}
				  ]);
    }, 3000);

    // Load map to index
    btamap = loadmap.generate('bta-map');
    loadmap.loadMap(btamap,'assets','btamap.svg')

    // Load stackbar
    stckbar = stackbar.generate("stckbar");
    stackbar.loadData(stckbar, [{'name':'cat1','value':0.25},
				{'name':'cat2','value':0.25},
				{'name':'cat3','value':0.2},
				{'name':'cat4','value':0.15},
				{'name':'cat5','value':0.15}]);
    setTimeout(function(){
	stackbar.updateData(stckbar,[{'name':'cat1','value':0.2},
				     {'name':'cat2','value':0.2},
				     {'name':'cat3','value':0.2},
				     {'name':'cat4','value':0.2},
				     {'name':'cat5','value':0.2}]);
    });

    //Load vertical bars
    vbars = bars.generate('vbars');
    bars.loadDataFromFile(vbars,'data/data.tsv');
    setTimeout(function(){
        // Load from data array
        bars.updateData(vbars,[{'name':'A','value':Math.random()*10},
				 {'name':'B','value':Math.random()*10},
				 {'name':'C','value':Math.random()*10},
				 {'name':'D','value':Math.random()*10},
				 {'name':'E','value':Math.random()*10},
				 {'name':'F','value':Math.random()*10},
				 {'name':'G','value':Math.random()*10}]);
    }, 3000);

    // Laod Calendar
    var cal = calendar.generate('calendar-chart');
    calendar.updateData(cal,[]);

    // load double bar
    dbars = double_bars.generate('double-bars-chart');
    double_bars.loadDataFromFile(dbars,'data/double-bars.csv');

    // Load pack chart
    pChart = pack.generate('pack-chart');
    pack.loadDataFromFile(pChart,'data/pack.json');

    // Load sankey
    sChart = sankey.generate('sankey-chart');
    sankey.loadDataFromFile(sChart,'Segment 1','data/sankey.csv',function(data){
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
