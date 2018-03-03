(function(){
    window.utils = {
	translation: function(x, y) { return 'translate(' + x + ',' + y + ')'; },
	parentWidth: function(elem) { return elem.parentElement.clientWidth; },
	widthCalc: function(id) { return this.parentWidth(document.getElementById(id));	},
	parentHeight: function(elem) { return elem.parentElement.clientHeight; },
	heightCalc: function(id) { return this.parentHeight(document.getElementById(id)); },
	getElemDim: function(id,dimension) { return document.getElementById(id).getBoundingClientRect()[dimension] }
    }
})();
