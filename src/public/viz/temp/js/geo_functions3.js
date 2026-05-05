var mapAux = [];
var mapPointAux = [];
$(document).ready(function() {
    function readJSON(file) {
	var request = new XMLHttpRequest();
	request.open('GET', file, false);
	request.send(null);
	if (request.status == 200)
            return JSON.parse(request.responseText);
    }

    var map = L.map('map').setView([4.64829,-74.09111], 5.5);

   //  L.tileLayer('https://{s}.tiles.mapbox.com/v3/{id}/{z}/{x}/{y}.png', {
   //     maxZoom: 18,
   //     attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, ' + '<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' + 'Imagery © <a href="http://mapbox.com">Mapbox</a>',
   //     id: 'examples.map-i875mjb7'
   // }).addTo(map);

    var myStyle = {
	"color": "black",
	"fillColor": "None",
	"weight": 0.5,
   };

   L.geoJson(readJSON("json/depto.json"),{style:myStyle}).addTo(map);

    var geojsonMarkerOptions = {
	radius: 8,
	fillColor: "#ff7800",
	color: "#ff7800",
	weight: 1,
	opacity: 1,
	fillOpacity: 0.8
    };
    
    var selectedColor = {fillColor: "green",color: "green" };
    var notSelectedColor = {fillColor: "#ff7800",color: "#ff7800"};
		  
    var mapPoint = L.geoJson(readJSON("json/compilado.min.geo.json"), {
	pointToLayer: function (feature, latlng) {
	    var point = L.circleMarker(latlng, geojsonMarkerOptions);
            return point;
	},
	onEachFeature: function (feature, layer) {
	    // does this feature have a property named name?
	    if (feature.properties && feature.properties.name) {
		layer.on('mouseover', function(e){
		    //var popup = L.popup().setLatLng(e.latlng).setContent(feature.properties.name).openOn(map);
		    //layer.bindPopup(feature.properties.name).openPopup().bind(layer);
		});
		layer.on('click', function(evt){
		    mapPoint.getLayers().forEach(function(l){l.setStyle(notSelectedColor);});
		    layer.setStyle(selectedColor);
		    var offset = {
			top: 10,
			right: 50,
			bottom: 10,
			left: 10
		    };
		    $(".city_name").text(feature.properties.name);
		    var aux_padding = {"top": 10,"right": 50,"bottom": 10,"left": 10};
		    var tempMax = c3.generate({
			bindto: "#chart_temp_max",
			padding: aux_padding,
			data: {
			    type: "line",
			    json: feature.properties.data,
			    keys: {
				x: "year",
				value: ["max_avg","med_avg","min_avg"]
			    }
			},
			tooltip: {
			    format:{
				//name: function(name,ratio,id,index){return "Temp. Max"},
				value: d3.format('.2f')
			    }
			},
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
			data: {
			    type: "line",
			    json: feature.properties.data[last_yr].months,
			    keys: {
				x: "month",
				value: ["max","med","min"]
			    }
			},
			tooltip: {
			    format:{
				title: function(d){return feature.properties.data[last_yr].months[d-1].title;},
				//name: function(name,ratio,id,index){return "Temp. Max"},
				value: d3.format('.2f')
			    }
			}
		    });
		});
	    }
	}
    }).addTo(map);
    // HACK: Select Bogotá as default by array position
    mapPoint.getLayers()[15].fire('click');
    mapPointAux = mapPoint;
});
