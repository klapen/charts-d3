var oas;
document.addEventListener('DOMContentLoaded', function(event) {
    // load double bar
    stackareaChart = stackarea.generate('stackarea-chart');
    stackarea.loadDataFromFile(stackareaChart,'0','data/stackarea.csv',function(data){	
	var cols = ['cat1','cat2','cat3','cat4','cat5','cat6','cat7','cat8','cat9'];
	var view = {};
 	data.map(function(d){
	    cols.map(function(c){
		if(!view[c]) view[c] = {'category':c,'total':0};
		view[c].total += +d[c];
		view[c][d['category']] = +d[c];
	    });
	});
	var columns = Object.keys(view.cat1);
	var res = Object.keys(view).reduce(function(acc,curr){
	    columns.map(function(c){
		if(c != 'category' && c != 'total') view[curr][c] = view[curr][c]/view[curr].total;
	    });
	    delete view[curr].total;
	    acc.push(view[curr]);
	    return acc;
	},[]);
	res.columns = columns;
	return res;
    });
    oas = stackareaChart;
});

