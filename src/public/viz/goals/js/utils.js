$(document).ready(function() {
    d3.json("json/futbol.json", function(error, json) {
	if (error) return console.warn(error);
	var sales_data = json;
	
	var width = 1100, height = 800, margin ={b:0, t:40, l:170, r:50};
	
	var svg = d3.select("#graph")
	    .append("svg").attr('width',width).attr('height',(height+margin.b+margin.t))
	    .append("g").attr("transform","translate("+ margin.l+","+margin.t+")");
	
	var data = [ 
	    {data:bP.partData(sales_data,2), id:'SalesAttempts', header:["Pais","Goles a favor"]},
	    {data:bP.partData(sales_data,3), id:'Sales', header:["Pais","Goles en contra"]},
	];
	
	bP.draw(data, svg);
    });
})
