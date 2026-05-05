$(document).ready(function() {

    var chart1 = c3.generate({
        bindto:'#donut_area_dpto',
        size: {
            width: 290
        },
        data: {
            columns: [
                ['Area Agricola', 27.09389546],
                ['Area Bosques', 72.65239123],
                ['Area Otros Usos', 0.25371330730],
            ],
            type : 'donut',
        },
	legend:{item:{onclick: function (d){} } },
        donut: {
            title: "Uso de la tierra"
        },

    });

    var chart2 = c3.generate({
        bindto:'#donut_financiero_dpto',
        size: {
            width: 290
        },
        data: {
            columns: [
                ['Ingresos Corrientes', 5804.87228],
                ['Ingresos De Capital', 72600.40731],
            ],
            type : 'donut',
        },
	legend:{item:{onclick: function (d){} } },
        donut: {
            title: "Ingresos totales: 78.405,27"
        },

    });

    var chart3 = c3.generate({
        bindto:'#line_security_mpio',
	size: {
             width: 750
	 },
        data: {
	    x: 'Año',
            columns: [['Año',1984,1985,1986,1987,1988,1989,1990,1991,1992,1993,1994,1995,1996,1997,1998,1999,2000,2001,2002,2003,2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015]],
            type : 'line',
        },
    });

     var chart_choco = c3.generate({
         bindto:'#line_sec_dpto',
	 size: {
             width: 400
	 },
         data: {
	     x: 'Año',
             columns: [
                 ['Año',1984,1985,1986,1987,1988,1989,1990,1991,1992,1993,1994,1995,1996,1997,1998,1999,2000,2001,2002,2003,2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015],
		 ['Expulsados',4047,229,306,331,259,692,798,618,867,668,1124,6399,11226,64906,10450,9923,23432,31344,45946,14188,17293,16559,12862,18022,16319,10353,7701,12800,18469,16798,14593,5244],
		 ['Recibidos',154,126,118,265,174,418,209,213,403,408,710,4804,4496,19036,5655,6366,15327,21065,33335,9608,10089,11735,6324,11036,8877,6965,4377,8187,10618,9162,7965,3037]
             ],
             type : 'line',
         }
     });
    
    var data_radar_1 = [
        [
            {axis: "ICV", value: 54.1234170044372},
            {axis: "NBS", value: 100-79.8413138356266},
            {axis: "Cob. salud", value: 99.8475501192286},
            {axis: "Cob. Educación Media", value: 43.3519082918895},
            {axis: "Cob. acueducto", value: 21.4912024163506}
        ]
    ];

    var LegendOptions = ['Chocó','Quibdó'];

    RadarChart.draw("#radar_dpto", data_radar_1);
    
    var data_radar_2 = [
	[
	    {axis: "ICV", value: 54.1234170044372},
	    {axis: "NBS", value: 100-79.8413138356266},
	    {axis: "Cob. salud", value: 99.8475501192286},
	    {axis: "Cob. Educación Media", value: 43.3519082918895},
	    {axis: "Cob. acueducto", value: 21.4912024163506}
	]
    ];
    RadarChart.draw("#radar_mpio", data_radar_2);
});
