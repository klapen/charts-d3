var oas = [];
var aux = [];
var _timeFormat = d3.time.format("%Y-%m-%d");
var _percentageFormat = d3.format(".2%");
$(document).ready(function() {
    $.getJSON("json/test.json", function(json) {
	info = getColumns(json.TotalNacional, ["TGP","TO","TD"]);
	var chart = c3.generate({
	    bindto: '#chart',
	    data: {
		x:'x',
		columns: [info["dates"],info["TGP"],info["TO"],info["TD"]]
	    },
	    axis: {
		x: {
		    type : 'timeseries',
		    tick: {
			//count: 12,
			format: d3.time.format("%m-%Y")
		    }
		},
		y:{
		    tick:{
			format: d3.format("%"),
		    }
		}
	    },
	    labels:{
		format:{
		    TGP:_percentageFormat,
		    TO:_percentageFormat,
		    TD:_percentageFormat
		}
	    },
	    tooltip:{
		format:{
		    title: d3.time.format("%m-%Y"),
		    value: _percentageFormat
		}
	    },
	    subchart:{show:true}
	});
	for(i=0;i<info["regions"].length;i++){
	    chart.regions.add(info["regions"][i]);
	};
    });
});

function getColumns(data,dict_keys){
    // TODO: Organize data per months/date
    var response = {};
    for(i=0;i<dict_keys.length;i++){
	response[dict_keys[i]]=[dict_keys[i]];
    };
    // TODO: Get regions per year
    var x_labels = ['x'];
    var regions = [];
    for(i=0;i<data.length;i++){
	var year = data[i];
	var start_region = "", end_region = "";
	for(j=0;j<year.Months.length;j++){
	    var month = year.Months[j];
	    var data_date = new Date(year.Year,month.Month-1,1);
	    x_labels.push(_timeFormat(data_date));
	    for(k=0;k<dict_keys.length;k++){
		response[dict_keys[k]].push(parseFloat(month[dict_keys[k]])/100);
	    };
	    // Create regions to display
	    if(month.Month-1 == 0){
		start_region = data_date;
	    }else if(month.Month == 12){
		end_region = data_date;
	    };
	};
	if(end_region && start_region){
	    regions.push({start:start_region,end:end_region,class: i%2 == 0 ? "regionX1":"regionX2"});
	}else if(start_region){
	    regions.push({start:start_region,class: i%2 == 0 ? "regionX1":"regionX2"});
	};
    };
    response["regions"] = regions,
    response["dates"] = x_labels;
    return response;
};
