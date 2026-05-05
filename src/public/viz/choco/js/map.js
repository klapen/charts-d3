var mapAux = [];
var oas;

$(document).ready(function() {
    function readJSON(file) {
	var request = new XMLHttpRequest();
	request.open('GET', file, false);
	request.send(null);
	if (request.status == 200)
            return JSON.parse(request.responseText);
    };
    function createTooltip(elem,titleClass,titleText,props){
	var div = document.createElement('div');
	div.classList.add(titleClass);
	div.innerHTML = "<h4>"+titleText+"</h4>";
	elem.appendChild(div);
	props.forEach(function(d){
	    var prop = document.createElement('div');
	    prop.classList.add('props');
	    prop.innerHTML = "<p><span>"+d.name+"</span> "+d.data+"</p>";
	    div.appendChild(prop);
	});
	elem.appendChild(div);
    };
    var map = L.map('map').setView([3.215352, -72.83112], 7.2);
    map.scrollWheelZoom.disable();

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

    var mapDepto = L.geoJson(readJSON("json/meta_lite.geo.json"),{style: mcipio_style}).addTo(map);
    
    var iconSize = [20, 30] 
    var normalIcon = L.icon({
	iconUrl: 'img/pin.png',
	iconSize: iconSize
    });
    var selectedIcon = L.icon({
	iconUrl: 'img/pin_sel.png',
	iconSize: iconSize
    });
   
    var mapPoint = L.geoJson(readJSON("json/meta.min.json"), {
	pointToLayer: function (feature, latlng) {
	    return L.marker(latlng, {icon: normalIcon});
	},
	onEachFeature: function (feature, layer) {
	    // does this feature have a property named name?
	    if (feature.properties && feature.properties.id_data.name) {
		layer.on('mouseover', function(e){
		    $("#mcipio-name").text(feature.properties.id_data.name);
		});
		layer.on('click', function(evt){
		    mapPoint.getLayers().forEach(function(l){l.setIcon(normalIcon);});
		    mapDepto.getLayers().forEach(function(d){
			if (d.feature.properties.MUN_P_CODE == feature.properties.id_data.cod){
			    d.setStyle(mcipio_style_selected);
			}else{
			    d.setStyle(mcipio_style);
			}
		    });
		    layer.setIcon(selectedIcon);
		    oas = feature;
		    $("#dpt-info-title").text(feature.properties.id_data.name);
		    // Create the HTML for each property
		    var info = document.getElementById("dpt-info");
		    info.innerHTML = "";
		    var div = document.createElement('div');
		    div.classList.add('sub-region-text');
		    div.innerHTML = "<p><span>Sub-region:</span> "+feature.properties.id_data.sub_region.name+"</p>";
		    info.appendChild(div);
		    // General props
		    createTooltip(info,"ddts","Variables Metodologías DDTS",feature.properties.general.ddts);
		    createTooltip(info,"poblacion","Totales Población 2015",feature.properties.general.poblacion_2015);
		    // Socioeconomical props
		    createTooltip(info,"pobreza","Pobreza",feature.properties.socioeconomico.pobreza);
		    createTooltip(info,"cobertura","Cobertura",feature.properties.socioeconomico.cobertura);
		    createTooltip(info,"seguridad","Seguridad",feature.properties.socioeconomico.seguridad);
		    // Finantial props
		    createTooltip(info,"ingresos","Ingresos",feature.properties.financiero.ingresos);
		});
	    }
	}
    }).addTo(map);
    mapAux = mapDepto;
});
