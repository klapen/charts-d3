var oas;
document.addEventListener('DOMContentLoaded', function(event) {
    // load double bar
    cpChart = comparativePlanet.generate('complanet-chart');
    comparativePlanet.loadDataFromFile(cpChart,'0','data/comparative-planet.csv',function(data){
	data = data.reduce(function(acc,curr){
            var order_data = data.columns.filter(function(d){
                return ['id','total','name'].indexOf(d) < 0;
            }).map(function(c){
                return {'name':c,'value':+curr[c],'total':+curr.total}
            }).sort(function(a,b){return b.value - a.value});
            acc[curr['id']] = {'name':curr.name,'data':order_data};
            return acc
        },{});
	return data;
    });
    oas = cpChart;
});
