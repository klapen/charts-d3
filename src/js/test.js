var oas;
document.addEventListener('DOMContentLoaded', function(event) {
    // load double bar
    pChart = pack.generate('pack-chart');
    oas = pChart;
    pack.loadDataFromFile(pChart,'data/pack.json');
})
