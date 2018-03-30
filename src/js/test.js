var oas;
document.addEventListener('DOMContentLoaded', function(event) {
    // load double bar
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
    oas = forceChart;
});
