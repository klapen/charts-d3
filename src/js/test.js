var oas;
document.addEventListener('DOMContentLoaded', function(event) {
    // load double bar
    multiChart = multilines.generate('multilines-chart');
    var cols = ['col1','col2'];
    multilines.loadDataFromFile(multiChart,{'x':'year','lines':cols},'data/multilines.csv',function(data){
	return data.map(function(d){
	    cols.map(function(c){ d[c] = +d[c] });
	    return d;
	})
    });
    oas = multiChart;
});
