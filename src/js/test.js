var oas;
document.addEventListener('DOMContentLoaded', function(event) {
    // load double bar
    rsbChart = radialStackbar.generate('radial-stackbar-chart');
    radialStackbar.loadDataFromFile(rsbChart,'values','data/radial-stackbar.csv',function(data){
	data.map(function(d){
	    d['total'] = 0;
	    data.columns.filter(function(c){ return c != 'name'})
		.forEach(function(col){
		    d.total += +d[col];
		})
	})
	//console.log('data',data)
	return data;
    });
    oas = rsbChart;
});
