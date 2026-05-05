$(document).ready(function() {
    var chart= c3.generate({
        bindto: "#chart_14001",
        padding: {
            top: 10,
            right: 10,
            bottom: 10,
            left: 10
        },
        data: {
            x: "año",
            columns:[
                ["año", 1996, 1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012],
                ["Número de empresas", 1, 1, 0, 6, 4, 8, 37, 60, 45, 47, 88, 172, 182, 303, 432, 409, 621]
            ],
            type: "bar"
        }
    });
});