$(document).ready(function() {
    function sortDescJSON(data, key) {
	return data.sort(function (a, b) {
            var x = a[key];
            var y = b[key];
            return ((x > y) ? -1 : ((x < y) ? 1 : 0));
	});
    };
    
    function sortAscJSON(data, key) {
	return data.sort(function (a, b) {
            var x = a[key];
            var y = b[key];
            return ((x < y) ? -1 : ((x > y) ? 1 : 0));
	});
    };
    
    function readJSON(file) {
	var request = new XMLHttpRequest();
	request.open('GET', file, false);
	request.send(null);
	if (request.status == 200)
            return JSON.parse(request.responseText);
    };

    var data = sortDescJSON(readJSON("json/poblacion_1985-2020.min.json"),"Year");
    var chart = c3.generate({
	data: {
            json: data[0].TotalNacional[0],
	    keys: ["Hombres","Mujeres"]
	},
	axis: {
            rotated: true
	}
    });
})
