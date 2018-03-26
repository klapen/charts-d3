var oas;
document.addEventListener('DOMContentLoaded', function(event) {
    // load double bar
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
    oas = stackareaChart;
});

