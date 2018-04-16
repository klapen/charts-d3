var oas;
document.addEventListener('DOMContentLoaded', function(event) {
    // load double bar
    areaChart = area.generate('area-chart');
    area.loadDataFromFile(areaChart,'values','data/area.json',function(data){
	data.values.map(function(d){
	    d[0] = new Date(d[0]);
	    d[1] = d[1]+Math.random();
	})
	return data;
    });
    oas = areaChart;
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
