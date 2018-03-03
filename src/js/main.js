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
})
