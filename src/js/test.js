var oas;
document.addEventListener('DOMContentLoaded', function(event) {
    // load double bar
    anaChart = analfabetismo.generate('ana-chart');
    analfabetismo.loadDataFromFile(anaChart,'range1','data/analfabetismo.csv',function(data){
	data = data.reduce(function(acc,curr){
	    acc[curr.name] = {'Male':[{'name':'Yes','value':+curr.m_yes},
				      {'name':'No','value':+curr.m_no},
				      {'name':'No info','value':+curr.m_no_info}],
			      'Female':[{'name':'Yes','value':+curr.f_yes},
					{'name':'No','value':+curr.f_no},
					{'name':'No info','value':+curr.f_no_info}]
			     }
	    return acc;
	},{})
	console.log(data);
	return data;
    });
    oas = anaChart;
});
