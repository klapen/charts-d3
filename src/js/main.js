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
    // monthlyGraph
    cal = calendar.generate('calendar-chart');
    calendar.loadDataFromFile(cal,'values','data/calendar.json',function(data){
	data.values.map(function(d){
	    d[0] = new Date(d[0]);
	})	
	return data;
    });

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

    // load sunburst
    sunChart = sunburst.generate('sunburst-chart');
    sunburst.loadDataFromFile(sunChart,'Segment 1','data/sunburst.json',function(data){
	return data;
    });

    stackareaChart = stackarea.generate('stackarea-chart');
    stackarea.loadDataFromFile(stackareaChart,'0','data/stackarea.csv',function(data){	
	var cols = ['cat1','cat2','cat3','cat4','cat5','cat6','cat7','cat8','cat9'];
	var total = {}
 	data.map(function(d){
	    total[d.category] = cols.reduce(function(acc,c){
		d[c] = +d[c];
		acc += d[c];
		return acc
	    },0);
	});

	data.map(function(d){
	    cols.map(function(c){
		d[c] = d[c]/total[d.category];
	    }) 
	});
	return data;
    });


    barstackChart = barstack.generate('barstack-chart');
    barstack.loadDataFromFile(barstackChart,'0','data/stackarea.csv',function(data){
	data.map(function(d){
	    d.total = data.columns.reduce(function(a,c){
		if(c != 'category'){
		    d[c] = +d[c];
		    a += d[c]
		};
		return a
	    },0);
	});
	data.map(function(d){
	    data.columns.map(function(c){
		if(c != 'category') d[c] = d[c]/d.total;
	    })
	    d.total = 1;
	});
	return data;
    });

    forceChart = force.generate('force-chart');
    force.loadDataFromFile(forceChart,'range1','data/planet.csv',function(data){
	data = data.reduce(function(acc,curr){
            var order_data = data.columns.filter(function(d){
                return ['id','total','name'].indexOf(d) < 0;
            }).map(function(c){
                return {'name':c,'value':+curr[c]}
            }).sort(function(a,b){return b.value - a.value});
            acc[curr['name']] = order_data;
            return acc
        },{'columns':data.columns})
	console.log(data);
	return data;
    });

    // multiChart = multilines.generate('multilines-chart');
    // var cols = ['col1','col2'];
    // multilines.loadDataFromFile(multiChart,{'x':'year','lines':cols},'data/multilines.csv',function(data){
    // 	return data.map(function(d){
    // 	    cols.map(function(c){ d[c] = +d[c] });
    // 	    return d;
    // 	})
    // });

    areaChart = area.generate('area-chart');
    area.loadDataFromFile(areaChart,'values','data/area.json',function(data){
	data.values.map(function(d){
	    d[0] = new Date(d[0]);
	    d[1] = d[1]+Math.random();
	})
	return data;
    });
    
    function simulateDataYear(){
	return ['2015','2016','2017'].reduce(function(acc,y){
	    ['01','02','03','04','05','06','07','08','09','10','11','12'].reduce(function(a,m){
		acc.push([[y,m,'01'].join('-'),Math.random()*4])
	    },0)
	    return acc;
	},[])
    }
    
    function simulateDataMonth(){
	var res = d3.timeDays(new Date(2018, 0, 1), new Date(2018, 12, 1));
	res = res.map(function(d){ return [d,Math.random()*4]; })
    }
    
    // load circular stack bar
    rsbChart = radialStackbar.generate('radial-stackbar-chart');
    radialStackbar.loadDataFromFile(rsbChart,'values','data/radial-stackbar.csv',function(data){
	data.map(function(d){
	    d['total'] = 0;
	    data.columns.filter(function(c){ return c != 'name'})
		.forEach(function(col){
		    d.total += +d[col];
		})
	})
	return data;
    });
})
