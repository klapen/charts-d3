var oas;
document.addEventListener('DOMContentLoaded', function(event) {
    // load double bar
    tbChart = timebars.generate('time-chart');
    tbChart.drawYear = true;
    timebars.loadDataFromFile(tbChart,'values','data/timebars.json',function(data){
	data.values.map(function(d){
	    d[0] = new Date(d[0]);
	})	
	//console.log(data);
	return data;
    });
    oas = tbChart;
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
