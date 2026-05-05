// Helper functions
String.prototype.toProperCase = function() {
    var i, j, str, lowers, uppers;
    str = this.replace(/([^\W_]+[^\s-]*) */g, function(txt) {
	return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
    
    // Certain minor words should be left lowercase unless 
    // they are the first or last words in the string
    lowers = ['A', 'De', 'La', 'El', 'Con', 'O', 'Para', 'En', 'Y'];
    for (i = 0, j = lowers.length; i < j; i++)
	str = str.replace(new RegExp('\\s' + lowers[i] + '\\s', 'g'), 
			  function(txt) {
			      return txt.toLowerCase();
			  });
    
    // Certain words such as initialisms or acronyms should be left uppercase
    uppers = ['Id', 'Tv'];
    for (i = 0, j = uppers.length; i < j; i++)
	str = str.replace(new RegExp('\\b' + uppers[i] + '\\b', 'g'), 
			  uppers[i].toUpperCase());
    
    return str;
}

String.prototype.removeWhiteSpaces = function() {
    return this.replace(new RegExp(' ', 'g'), '');
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

var nodes; // to replace for nodes
var onoff; // to simulate the click
var changeSector; // to hide circles on sector selection
var force; // to do debug/new features
var sel_sector = "Movilidad",
    sector_val = 0,
    total_value = 0,
    sector_percentage = 0;
var sectors = [];
var n = 100, // total number of nodes
    m = 2; // number of distinct clusters

var width = 600,
    height = 750,
    padding = 2, // separation between nodes
    maxRadius = 15, // radius to calculate circule radius
    pFormat = d3.format(".1%"),
    pSmallFormat = d3.format(".4%"),
    cFormat = d3.format("$,.2f");

var color = {
    none: "#006d2c",
    highUp: "#2ca25f",
    highMedium: "#66c2a4",
    highDown: "#b2e2e2",
    neutral: "#b3b3b3",
    lowUp: "#fdcc8a",
    lowMedium: "#fc8d59",
    lowDown: "#e34a33"
}
var labels = {
    sector: "Sector",
    entity: "Entidad",
    value: "Monto",
    variation: "Variación",
    // gov_level: "Nivel de gobierno",
    subgroup: "Tipo de gasto",
    account: "Cuenta Mayor",
    plan: "Cuenta auxiliar / Plan",
    objective: "Cuenta auxiliar / Objetivo",
    program: "Programa",
    project:"Proyecto"
}

var click_selection = {
    pointA: width/4+100,
    pointB: width-50
}
// HACK: calculated decils to fin the radius, should be a function
var decils = [0,
	      6300000,
	      78820000,
	      191104000,
	      300000000,
	      500000000,
	      880000000,
	      1187000000,
	      1668885000,
	      2049775000,
	      2441501000,
	      3186252000,
	      4142118000,
	      5479500000,
	      6908923000,
	      9789268000,
	      15546270000,
	      23969040000,
	      41227063000,
	      82433130000,
	      877108937000]

$(document).ready(function(){
    var x = d3.scale.ordinal()
        .domain(d3.range(m))
        .rangePoints([0, width], 1);

    d3.csv("json/movilidad.csv", function(d){
	return {
	    sector: d.sector.toProperCase().trim(),
	    entity: d.entity.toProperCase().trim(),
	    value: isNaN(parseFloat(d.value)) ? d.value : parseFloat(d.value),
	    log: Math.log(d.value),
	    variation: isNaN(parseFloat(d.variation)) ? d.variation : parseFloat(d.variation),
	    gov_level: d.gov_level.toProperCase().trim(),
	    subgroup: d.subgroup.toProperCase().trim(),
	    account: d.account.toProperCase().trim(),
	    plan: d.plan.toProperCase().trim(),
	    objective: d.objective.toProperCase().trim(),
	    program: d.program.toProperCase().trim(),
	    project: d.project.toProperCase().trim(),
	};
    },function(error,rows){
	// Load nodes
	nodes = rows;
	total_value = d3.sum(nodes, function(d){return d.value})
	sector_value = d3.sum(nodes, function(d){if(d.sector == sel_sector) return d.value;});
	sector_percentage = sector_value/total_value;
 	nodes.forEach(function(d){
	    // Set color and position
	    d.cx = click_selection.pointA;
	    d.y = d.cy = height/2;
	    var gap = 100,
	    	sec_padd=20;
	    var h_secs = [height/5-50,(2*height)/5,(3*height)/5,(4*height)/5];
	    if (d.variation == "none"){
		d.color = color.none;
		d.y = d.cy = getRandomInt(0,h_secs[0]-sec_padd)+(gap/0.8);
	    }
	    else if(d.variation > 1){
	    	d.color = color.none;
		d.y = d.cy = getRandomInt(0,h_secs[0]-sec_padd)+gap;
	    }
	    else if(d.variation > 0.3){
	    	d.color = color.highUp;
		d.y = d.cy = getRandomInt(0,h_secs[0]-sec_padd)+(gap/0.6);
	    }
	    else if(d.variation > 0.15){
	    	d.color = color.highMedium;
		d.y = d.cy = getRandomInt(0,h_secs[0]-sec_padd)+(gap/0.5);
	    }
	    else if(d.variation > 0.02){
	    	d.color = color.highDown;
		if (d.variation > 0) d.y = d.cy = getRandomInt(h_secs[0]+sec_padd,(height/2)-sec_padd)+gap;
		else if (d.variation < 0) d.y = d.cy = getRandomInt((height/2)-sec_padd,h_secs[1]+sec_padd)+gap;
		else d.y = d.cy = height/2;
	    }
	    else if(d.variation < -0.02 & d.variation > -0.149){
	    	d.color = color.lowUp;
		d.y = d.cy = getRandomInt(h_secs[1]+sec_padd,h_secs[2]-sec_padd)+(gap/0.8);
	    }
	    else if(d.variation < -0.15 & d.variation > -0.299){
	    	d.color = color.lowMedium;
		d.y = d.cy = getRandomInt(h_secs[1]+sec_padd,h_secs[2]-sec_padd)+(gap/0.5);
	    }
	    else if(d.variation < -0.3 & d.variation > -1){
	    	d.color = color.lowDown;
		d.y = d.cy = getRandomInt(h_secs[1]+sec_padd,h_secs[2]-sec_padd)+(gap/0.4);
	    }
	    else{
	    	d.color = color.neutral;
	    	d.y = d.cy = height/2+gap;
            };
	    d.group = "All";
	    d.x = d.sector == sel_sector ? width-100 : getRandomInt(0,width-200);

	    // Set radius
	    for(j=1; j< decils.length;j++){
		if(d.value <= decils[j]){
		    d.radius = maxRadius*(j/(decils.length-1))
		    break;
		};
	    };
	    if(undefined == d.radius) d.radius = maxRadius*2;

	    // Create sectors array
	    if(d.sector != sel_sector && sectors.indexOf(d.sector) < 0)	sectors.push(d.sector);
	});
	
	// Create force
	force = d3.layout.force()
	    .nodes(nodes)
	    .size([width, height])
	    .friction(0.8)
	    .gravity(0.05)
	    .charge(function(d){
                if (d.value == 0) return 0;
                else return -Math.pow(d.radius,2.0)/8 
            })
	    .on("tick", tick)
	    .start();

	// Add and remove class in Graph2
	function hasClass(el, className) {
	    if (el.classList)
		return el.classList.contains(className)
	    else
		return !!el.className.match(new RegExp('(\\s|^)' + className + '(\\s|$)'))
	}

	function addClass(el, className) {
	    if (el.classList)
		el.classList.add(className)
	    else if (!hasClass(el, className)) el.className += " " + className
	}

	function removeClass(el, className) {
	    if (el.classList)
		el.classList.remove(className)
	    else if (hasClass(el, className)) {
		var reg = new RegExp('(\\s|^)' + className + '(\\s|$)')
		el.className=el.className.replace(reg, ' ')
	    }
	}

	var el = document.getElementById('label-content');

	var svg = d3.select("#chart").append("svg")
	    .attr("width", width)
	    .attr("height", height);
	var circle = svg.selectAll("circle")
	    .data(nodes)
	    .enter().append("circle")
	    .attr("r", function(d) { return d.radius; })
	    .style("fill", function(d) { return d.color; })
	    .on("click",fillTooltip)
	    .call(function(){return;}); // HACK: Avoid draggable circles

	var sector_sel = document.getElementById('sel_sectors');
	for(i = 0; i<sectors.length; i++) { 
	    opt = document.createElement('option');
	    opt.value = opt.innerHTML = sectors[i];
	    sector_sel.appendChild(opt);
	};
	
	function fillTooltip(d,i){
	    document.getElementById("label-content").classList.add("hidden");
	    // first clear content/tooltip display
	    circle.classed('focusCircle',false);
	    d3.select("#graph_2").selectAll("*").remove();
	    // Fill content/tooltip display
	    var tooltip = d3.select("#graph_2");
	    var participation = d["value"]/total_value;
	    if (participation < 0.001) tooltip.append("h5").text("Participación: "+pSmallFormat(participation));
	    else tooltip.append("h5").text("Participación: "+pFormat(participation));
	    for(var key in labels){
		if(d[key] != ""){
		    addClass(this, 'focusCircle');
		    var div = tooltip.append("div").attr('class',key);
		    div.append("h5").text(labels[key]);
		    if (key == "variation") {
			if (d[key] == "none") div.append("p").text("Sin monto en el 2014");
			else div.append("p").text(pFormat(d[key]));
			div.style("background-color", d.color);
		    }
		    else if (key == "value") {
			if(d[key].toString().length > 12){
			    div.append("p").text(cFormat(d[key]/1000000000000).replace(".",",")+" billones")
			}else if(d[key].toString().length > 9){
			    div.append("p").text(cFormat(d[key]/1000000000).replace(".",",")+" mil millones")
			}else if(d[key].toString().length > 6){
			    div.append("p").text(cFormat(d[key]/1000000).replace(".",",")+" millones")
			}else{
			    div.append("p").text(cFormat(d[key]))
			}
		    }
		    else{
			div.append("p").text(d[key]);
		    }
		}
	    }	    
	};
	//Tick functions
	function tick(e) {
	    circle.each(gravity(0.05 * e.alpha))
		.each(collide(.5))
		    .attr("cx", function(d) { return d.x; })
		.attr("cy", function(d) { return d.y; });
	};
	function tick_sel(selector) {
	    // move cx axis for gravitation
	    force.nodes().forEach(function(d){
		if (selector && d.sector == sel_sector){
		    d.cx = click_selection.pointB;
		    d.group = "Selected";
		}else {
		    d.cx = click_selection.pointA;
		    d.group = "All";
		}
	    });
	    force.on("tick",tick);
	    force.resume();
	};

	// Move nodes toward cluster focus.
	function gravity(alpha) {
	    return function(d) {
		d.y += (d.cy - d.y) * alpha;
		d.x += (d.cx - d.x) * alpha;
	    };
	};
	
	// Resolve collisions between nodes.
	function collide(alpha) {
	    var quadtree = d3.geom.quadtree(nodes);
	    return function(d) {
		var r = d.radius + maxRadius + padding,
		    nx1 = d.x - r,
		    nx2 = d.x + r,
		    ny1 = d.y - r,
		    ny2 = d.y + r;
		quadtree.visit(function(quad, x1, y1, x2, y2) {
		    if (quad.point && (quad.point !== d) && (d.group === quad.point.group)) {
			var x = d.x - quad.point.x,
			    y = d.y - quad.point.y,
			    l = Math.sqrt(x * x + y * y),
			    r = d.radius + quad.point.radius + + (d.color !== quad.point.color) * padding;// + (d.group !== quad.point.group) * padding;
			if (l < r) {
			    l = (l - r) / l * alpha;
			    d.x -= x *= l;
			    d.y -= y *= l;
			    quad.point.x += x;
			    quad.point.y += y;
			}
		    }
		    return x1 > nx2 || x2 < nx1 || y1 > ny2 || y2 < ny1;
		});
	    };
	};

	changeSector = function(opt){
	    d3.select("#sec_value").text("");
	    circle.classed("hideSector",function(d){
		if (opt == "all") return false;
		else return d.sector != opt;
	    });
	    circle.classed("showSector",function(d){
		if (opt == "all") return true;
		else return d.sector == opt;
	    });
	    if (opt == "all") d3.select("#sec_value").text(pFormat(1));
	    else d3.select("#sec_value").text(pFormat(d3.sum(nodes, function(d){if(d.sector == opt) return d.value;})/total_value));
	};

	// move the selector
	onoff = function(elem){
	    if(elem.value == "Movilidad"){
		document.getElementById("off").classList.remove("active");
		document.getElementById("sectors").classList.remove("active");
		document.getElementById("on").classList.add("active");
		d3.select("#sel_percentage").text(pFormat(sector_percentage));
		addClass(document.getElementById("sector_section"), 'invisible');
		removeClass(document.getElementById("movility_text"), 'invisible');
		changeSector("all");
		tick_sel(true);
	    }
	    else if(elem.value == "Total por sectores"){
		document.getElementById("off").classList.remove("active");
		document.getElementById("on").classList.remove("active");
		document.getElementById("sectors").classList.add("active");
		removeClass(document.getElementById("sector_section"), 'invisible');
		document.getElementById("sel_sectors").selectedIndex = 0;
		addClass(document.getElementById("movility_text"), 'hidden');
		tick_sel(false);
	    }else{
		document.getElementById("on").classList.remove("active");
		document.getElementById("sectors").classList.remove("active");
		document.getElementById("off").classList.add("active");
		d3.select("#sel_percentage").text("");
		addClass(document.getElementById("sector_section"), 'invisible');
		addClass(document.getElementById("movility_text"), 'invisible');
		changeSector("all");
		tick_sel(false);
	    }
	};
    });
});
