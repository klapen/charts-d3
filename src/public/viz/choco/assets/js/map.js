$(document).ready(function() {
    function readJSON(file) {
	var request = new XMLHttpRequest();
	request.open('GET', file, false);
	request.send(null);
	if (request.status == 200)
            return JSON.parse(request.responseText);
    };
    
    // Town style layer
    var mcipio_style = {
	color: "black",//"#EAEAEB",
	fillOpacity: 1,
	fillColor: "#EAEAEB",
	weight: 0.8,
	opacity: 1
    };

    // Town selected style layer
    var mcipio_style_selected = {
	color: "#FF7F41",
	fillOpacity: 1,
	fillColor: "#FF7F41",
	weight: 0.8,
	opacity: 1
    };

    // Create map object to manage the layers
    var map = L.map('map').setView([6.33,-76.937325256405998], 7.9);
    map.scrollWheelZoom.disable();
    // Load a layer with Choco municipios
    var mapDepto = L.geoJson(readJSON("json/choco.geo.json"),{style: mcipio_style}).addTo(map);
    // Icon variables to set municipios selector
    var iconSize = [20, 30] 
    var normalIcon = L.icon({
	iconUrl: 'img/pin.png',
	iconSize: iconSize
    });
    var selectedIcon = L.icon({
	iconUrl: 'img/pin_sel.png',
	iconSize: iconSize
    });

})
