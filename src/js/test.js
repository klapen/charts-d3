var oas;
document.addEventListener('DOMContentLoaded', function(event) {
    // load double bar
    sunChart = sunburst.generate('sunburst-chart');
    sunburst.loadDataFromFile(sunChart,'Segment 1','data/sunburst.json',function(data){
	return data;
    });
    oas = sunChart;
})
