var oas;
document.addEventListener('DOMContentLoaded', function(event) {
    // load double bar
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
    oas = barstackChart;
});

