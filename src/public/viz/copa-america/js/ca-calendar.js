// Define varibles to use
var data;
var data2;
// Helpers to debug
var oas=[],aux=[];

// Read data file
function readFile(file){
    var response = {};
    response = d3.nest().key(function(d){return d.code}).map(file);
    d3.keys(response).forEach(function(d){
	var cups = response[d];
	response[d] = {};
	// Add first total
	response[d].total = {
	    'name':cups[0].name,
	    'PJ':d3.sum(cups,function(c){return c.PJ}),
	    'PG':d3.sum(cups,function(c){return c.PG}),
	    'PE':d3.sum(cups,function(c){return c.PE}),
        'PP':d3.sum(cups,function(c){return c.PP}),
	    'GF':d3.sum(cups,function(c){return c.GF}),
	    'GC':d3.sum(cups,function(c){return c.GC})
	};
	// Add values
	response[d].cups = cups;
    response[d].code = d;
    });
    return response;
};

function readFileMatches(file){
	var response = {};
	response = d3.nest().key(function(d){return d.match}).map(file);
	d3.keys(response).forEach(function(d){
		var game = response[d];
		response[d] = {};
		response[d].smash = {
			'group': game[0].group,
			'teams': game[0].teams,
			'stadium': game[0].stadium,
			'hour': game[0].hour
		};
		response[d].match = d;
	});
	return response;
};

// Create table
function createTable(id,columns,rows,classname){
    var table = d3.select(id).append('table')
	.attr('class','table '+classname);
    var thead = table.append('thead');
    var tbody = table.append('tbody');

    // Append the header row
    thead.append('tr').selectAll('th')
	.data(columns).enter().append('th')
	.text(function(col){
	    if(col == 'year') return 'Año';
	    else if(col == 'cup_host') return 'Sede';
	    else return col;
	});
    // Append rows
    var rows = tbody.selectAll('tr').data(rows).enter()
	.append('tr');
    // Create cells
    var cells = rows.selectAll('td')
	.data(function(row){
	    return columns.map(function(col){
		return {col:col,value:row[col]};
	    });
	}).enter().append('td')
	.attr('class',function(d,i){return 'cell-'+d.col+' row-'+i})
	.html(function(d){return d.value});

    return table;
};

// Main
$(document).ready(function(){
    // Load data
    d3.csv("db/ca-stats_v2.csv",function(error,file){
    	data = readFile(file);
    });
    d3.csv("db/ca_matches.csv", function(error, file){
    	data2 = readFileMatches(file);
    });
    // Load SVG File
    d3.xml('svg/calendar_v4.svg','image/svg+xml',function(error,xml){
		if (error) throw error;
		document.getElementById('ca-calendar').appendChild(xml.documentElement);
		// Set data and classes for each element with datum
		elements =  d3.selectAll('.pais-circle');
		elements.datum(function(d,i){
		    // Add data from JSON for each country
		    return data[this.id];
		});
		
		// document.getElementById('partidos').appendChild(xml.documentElement);
		matches = d3.selectAll('.matches');
		matches.datum(function(d,i){
			return data2[this.id];
		});

		// console.log(matches);

		// Bind interaction with each element
		elements.on('click',function(d){
	        var that = this;
	        elements.style('opacity',function(d){return this.id == that.id ?'1':'0.5'});
		    // Create table to display data
		    document.getElementById('country-table').innerHTML = '';
		    if(d){
				document.getElementById('country-table').innerHTML = '<h3>'+d.total.name+'</h3>';
				// Set titles
				createTable('#country-table',d3.keys(d.total).filter(function(k){return 'name'!=k;}),[d.total],'total');
				createTable('#country-table',d3.keys(d.cups[0]).filter(function(k){return 'code'!=k && 'name'!=k}),d.cups,'cups');
		    	}else{
					document.getElementById('country-table').innerHTML = '<h3>No ha participado en la Copa América</h3>';
		    };
		});

		matches.on('click',function(d){
			document.getElementById('country-table').innerHTML = '';
			if (d){
				document.getElementById('country-table').innerHTML = '<h3>'+d.smash.group+'</h3>'+'<br>'+'<h4>'+d.smash.teams + '</h4>' + '<br>' + '<h5><i>Estadio: </i>' + d.smash.stadium + '</h5' + '<br>' + '<h5><i>Hora: </i>' + d.smash.hour + '</h5>';
			};
		});
    });
})
