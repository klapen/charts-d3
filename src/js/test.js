var oas;
document.addEventListener('DOMContentLoaded', function(event) {
    // load double bar
    dbars = double_bars.generate('double-bars-chart');
    oas = dbars;
    double_bars.loadDataFromFile(dbars,'data/double-bars.csv');
})
