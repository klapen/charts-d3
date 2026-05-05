var info_mpio,sec_series_mpio,oas;
$(document).ready(function() {
    function readJSON(file) {
	var request = new XMLHttpRequest();
	request.open('GET', file, false);
	request.send(null);
	if (request.status == 200)
            return JSON.parse(request.responseText);
    }
    
    function createTBodySection(elem,props,num_format){
	var tbody = document.createElement('tbody');
	props.forEach(function(d){
	    var prop = document.createElement('tr');
	    if(isNaN(d.data)){
		prop.innerHTML = "<td>"+d.name+"</td><td>"+d.data+"</td>";
	    }else{
		prop.innerHTML = "<td>"+d.name+"</td><td>"+num_format(d.data)+"</td>";
	    }
	    tbody.appendChild(prop);
	});
	elem.appendChild(tbody);
    };

    function createGraphSection(elem,database,cod){
	elem.innerHTML = "";
	var div = document.createElement('div');
	div.id = "sec_series_graph";
	elem.appendChild(div);
	// Create graph
	var yrs = ['Año'],expelled = ['Expulsados'],recv=['Recibidos'];
	database.Expulsados[cod].forEach(function(d){
	    yrs.push(d.key);
	    expelled.push(d.value);
	});
	database.Recibidos[cod].forEach(function(d){
	    recv.push(d.value);
	});
	var chartaux = c3.generate({
	    bindto:'#sec_series_graph',
	    size: {
		width: 750
	    },
	    data: {
		x: 'Año',
		columns: [yrs,expelled,recv],
		type : 'line',
	    },
	    transition: {duration: 500},
	});
    };

    function createMpioPobSection(database){
	var elem = document.getElementById("population_mpio_1");
	elem.innerHTML = "";
	var div = document.createElement('div');
	div.id = "pop_mpio_graph_1";
	elem.appendChild(div);
	var chart_pop_1 = c3.generate({
            bindto:'#pop_mpio_graph_1',
            size: {
		width: 290
            },
            data: {
		columns: [
                    ['Cabecera', database[2].data],
                    ['Resto', database[3].data],
		],
		type : 'donut',
		colors: {
		    Cabecera: '#2C2416',
		    Resto: '#BAA378'
		},
		selection: {enabled: false}
            },
	    transition: {duration: 1500},
	    legend:{item:{onclick: function (d){} } },
            donut: {
		title: "Cabecera vs Resto"
            }
	});
	
	elem = document.getElementById("population_mpio_2");
	var div = document.createElement('div');
	div.id = "pop_mpio_graph_2";
	elem.appendChild(div);
	var chart_pop_2 = c3.generate({
            bindto:'#pop_mpio_graph_2',
            size: {
		width: 290
            },
            data: {
		columns: [
                    ['Hombres', database[4].data],
                    ['Mujeres', database[5].data],
		],
		type : 'donut',
		colors: {
		    Hombres: '#13A1CB',
		    Mujeres: '#EB77A6'
		},
		selection: {enabled: false}
            },
	    transition: {duration: 1500},
	    legend:{item:{onclick: function (d){} } },
            donut: {
		title: "Hombres vs Mujeres"
            }
	});
    };
    
    // Town style layer
    var mcipio_style = {
	color: "black",//"#EAEAEB",
	fillOpacity: 0.7,
	fillColor: "#EAEAEB",
	weight: 0.8,
	opacity: 1
    };
    // Load mpio database
    info_mpio=readJSON("json/info_mpio.min.json");
    sec_series_mpio=readJSON("json/desplazados_violencia_mpio.min.json"); 

    // Town selected style layer
    var mcipio_style_selected = {
	color: "#FF7F41",
	fillOpacity: 0.7,
	fillColor: "#FF7F41",
	weight: 0.8,
	opacity: 1
    };

    // Create map object to manage the layers
    var map = L.map('map').setView([6.31,-76.937325256405998], 7.5);
    map.scrollWheelZoom.disable();
    // Load a layer with Choco municipios
    var mapDepto = L.geoJson(readJSON("json/choco.geo.json"),{style: mcipio_style,
			     onEachFeature: function(feature,layer){
				 if (feature.properties && feature.properties.NOM_MUNICI) {
				     layer.on('mouseover', function(e){
					 $("#mcipio-name").text(feature.properties.NOM_MUNICI);
				     });
				     layer.on('click', function(evt){
					 var divipola = feature.properties.ID_ESPACIA;
					 mapDepto.getLayers().forEach(function(d){
					     if (d.feature.properties.ID_ESPACIA == divipola){
						 d.setStyle(mcipio_style_selected);
					     }else{
						 d.setStyle(mcipio_style);
					     }
					 });
					 $("#dpt-info-title").text(feature.properties.NOM_MUNICI);
					 // Create population table
					 createMpioPobSection(info_mpio[divipola].data.population);
					 var info_pob_mpio = document.getElementById("info_pob_mpio");
					 info_pob_mpio.innerHTML = "";
					 createTBodySection(info_pob_mpio,
							    info_mpio[divipola].data.population,
							    d3.format(".0f"));
					 // Create socioeconomical table
					 var data_radar_2 = [
					     [
						 {axis: "ICV", value: 54.1234170044372},
						 {axis: "NBS", value: 100-79.8413138356266},
						 {axis: "Cob. salud", value: 99.8475501192286},
						 {axis: "Cob. Educación Media", value: 43.3519082918895},
						 {axis: "Cob. acueducto", value: 21.4912024163506}
					     ],
					     [
						 {axis: "ICV", value: info_mpio[divipola].data.socioeconomic[0].data},
						 {axis: "NBS", value: 100-info_mpio[divipola].data.socioeconomic[1].data},
						 {axis: "Cob. salud", value: info_mpio[divipola].data.socioeconomic[2].data},
						 {axis: "Cob. Educación Media", value: info_mpio[divipola].data.socioeconomic[3].data},
						 {axis: "Cob. acueducto", value: info_mpio[divipola].data.socioeconomic[6].data}
					     ]
					 ];
					 RadarChart.draw("#radar_mpio", data_radar_2);
					 var info_socio_mpio = document.getElementById("info_socio_mpio");
					 info_socio_mpio.innerHTML = "";
					 createTBodySection(info_socio_mpio,
							    info_mpio[divipola].data.socioeconomic,
							    d3.format(".3f"));
					 info_socio_mpio = document.getElementById("info_socio_mpio_sgp2");
					 info_socio_mpio.innerHTML = "";
					 createTBodySection(info_socio_mpio,
							    info_mpio[divipola].data.sgp2015,
							    d3.format(".3f"));
					 // Create financial table
					 var info_fin_mpio = document.getElementById("info_financiero_mpio");
					 info_fin_mpio.innerHTML = "";
					 createTBodySection(info_fin_mpio,
							    info_mpio[divipola].data.finantial.slice(0,8),
							    d3.format(".3f"));
					 info_fin_mpio = document.getElementById("info_financiero_mpio_2");
					 info_fin_mpio.innerHTML = "";
					 createTBodySection(info_fin_mpio,
							    info_mpio[divipola].data.finantial.slice(8,14),
							    d3.format(".3f"));
					 info_fin_mpio = document.getElementById("info_financiero_mpio_3");
					 info_fin_mpio.innerHTML = "";
					 createTBodySection(info_fin_mpio,
							    info_mpio[divipola].data.finantial.slice(14,20),
							    d3.format(".3f"));
					 // Create geostrategic table
					 var info_geostra_mpio = document.getElementById("info_geoest_mpio");
					 info_geostra_mpio.innerHTML = "";
					 createTBodySection(info_geostra_mpio,
							    info_mpio[divipola].data.geostrategic.slice(0,7),
							    d3.format(".3f"));
					 info_geostra_mpio = document.getElementById("info_geoest_mpio_2");
					 info_geostra_mpio.innerHTML = "";
					 createTBodySection(info_geostra_mpio,
							    info_mpio[divipola].data.geostrategic.slice(7,23),
							    d3.format(".3f"));
					 // Create security table
					 createGraphSection(document.getElementById("line_security_mpio"),
							    sec_series_mpio,divipola);
					 var info_sec_mpio = document.getElementById("info_security_mpio");
					 info_sec_mpio.innerHTML = "";
					 createTBodySection(info_sec_mpio,
							    info_mpio[divipola].data.security.slice(0,3),
							    d3.format(".0f"));
					 info_sec_mpio = document.getElementById("info_security_mpio_2");
					 info_sec_mpio.innerHTML = "";
					 createTBodySection(info_sec_mpio,
							    info_mpio[divipola].data.security.slice(3,9),
							    d3.format(".3f"));
				     });
				 }
			     }}).addTo(map);
});
