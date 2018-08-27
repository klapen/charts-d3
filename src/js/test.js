var oas;
document.addEventListener('DOMContentLoaded', function(event) {
    // load double bar
    dml = doubleMultilines.generate('double-multilines-chart');
    var cols = {'upper':['col1','col2'],'bottom':['col3','col4']};
    doubleMultilines.loadDataFromFile(dml,{'x':'year','lines':cols},'data/double-multilines.csv',
				      function(data){
					  var res = data.map(function(d){
     					      cols.upper.map(function(c){ d[c] = +d[c] });
					      cols.bottom.map(function(c){ d[c] = +d[c] });
     					      return d;
     					  })
					  //console.log('data',res)
					  return res;
				      });
    oas = dml;
});
