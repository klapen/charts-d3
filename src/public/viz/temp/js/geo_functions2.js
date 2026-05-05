$(document).ready(function() {
    function readJSON(file) {
	var request = new XMLHttpRequest();
	request.open('GET', file, false);
	request.send(null);
	if (request.status == 200)
            return JSON.parse(request.responseText);
    }

    var map = L.map('map').setView([4.64829,-74.09111], 5);

    L.tileLayer('https://{s}.tiles.mapbox.com/v3/{id}/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, ' +
   	    '<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
    	    'Imagery © <a href="http://mapbox.com">Mapbox</a>',
        id: 'examples.map-i875mjb7'
    }).addTo(map);
    
    //var myStyle = {
//	"color": "black",
//	"fillColor": "None",
//	"weight": 0.5,
  // };

   //L.geoJson(readJSON("js/depto.json"),{style:myStyle}).addTo(map);

    var geojsonMarkerOptions = {
	radius: 8,
	fillColor: "#ff7800",
	color: "#000",
	weight: 1,
	opacity: 1,
	fillOpacity: 0.8
    };

    var mapPoint = L.geoJson(readJSON("json/col-temp-max.min.geo.json"), {
	pointToLayer: function (feature, latlng) {
	    var point = L.circleMarker(latlng, geojsonMarkerOptions);
            return point;
	},
	onEachFeature: function (feature, layer) {
	    // does this feature have a property named name?
	    if (feature.properties && feature.properties.name) {
		layer.on('mouseOver', function(e){
		    layer.bindPopup(feature.properties.name);
		});
		layer.on('click', function(evt){ 
		    var offset = {
			top: 10,
			right: 50,
			bottom: 10,
			left: 10
		    };
		    var dimensions = {
			width: 450,
			height: 450
		    }
		    $(".city_name").text(feature.properties.name);
		    var aux_padding = {"top": 10,"right": 50,"bottom": 10,"left": 10};
		    var tempMax = c3.generate({
			bindto: "#chart_temp_max",
			padding: aux_padding,
			size: dimensions,
			data: {
			    type: "line",
			    json: feature.properties.data,
			    keys: {
				x: "year",
				value: ["average"]
			    }
			},
			tooltip: {
			    format:{
				name: function(name,ratio,id,index){return "Temp. Max"},
				value: d3.format('.2f')
			    }
			},
			legend: {show: false},
			axis: {
			    y: {
				padding: {left: 200}
			    }
			}
		    });
		    var last_yr = feature.properties.data.length - 1;
		    var tempLastYr = c3.generate({
			bindto: "#chart_last_yr",
			padding: aux_padding,
			size: dimensions,
			data: {
			    type: "line",
			    json: feature.properties.data[last_yr].months,
			    keys: {
				x: "month",
				value: ["data"]
			    }
			},
			tooltip: {
			    format:{
				title: function(d){return feature.properties.data[last_yr].months[d-1].title;},
				name: function(name,ratio,id,index){return "Temp. Max"},
				value: d3.format('.2f')
			    }
			},
			legend: {show: false}
		    });
		});
	    }
	}
    }).addTo(map);
    // HACK: Select Bogotá as default by array position
    mapPoint.getLayers()[15].fire('click');
});
