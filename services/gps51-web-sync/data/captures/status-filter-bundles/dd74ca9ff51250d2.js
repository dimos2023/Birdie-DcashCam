var Size = maptalks.Size;
var Geometry = maptalks.Geometry;
var Marker = maptalks.Marker;
var Label = maptalks.Label;
var AreaTool = maptalks.AreaTool;

function MyAreaTool() {
    AreaTool.apply(this, arguments);
}


MyAreaTool.prototype = AreaTool.prototype;
MyAreaTool.prototype.constructor = MyAreaTool;

MyAreaTool.prototype._measure = function(toMeasure) {
    var map = this.getMap();
    var area;
    if (toMeasure instanceof Geometry) {
        area = map.computeGeometryArea(toMeasure);
    } else if (Array.isArray(toMeasure)) {
        area = map.getProjection().measureArea(toMeasure);
    }

    this._lastMeasure = area;
    var units;
    if (this.options['language'] === 'zh-CN') {
        units = [' 平方米', ' 平方公里', ' 平方米', ' 平方亩'];
    } else {
        units = [' sq.m', ' sq.km', ' sq.m', ' acre'];
    }
    var content = '';
    if (this.options['metric']) {
        //如果小于1平方千米,用平方米
        if (area < 1E6) {
            content += area.toFixed(0) + units[0];
        } else {
            var sqkm = area / 1E6;
            content += sqkm.toFixed(2) + units[1];
        }
        // content += area < 1E6 ? area.toFixed(0) + units[0] : (area / 1E6).toFixed(2) + units[1];
    }
    if (this.options['imperial']) {
        // area *= 3.2808399;
        if (content.length > 0) {
            content += '\n';
        }

        if (this.options['language'] === 'zh-CN') {
            //显示亩
            var muUnit = 666.6666667;
            if (area < muUnit) {
                content += area.toFixed(0) + units[0];
            } else {
                var resultMu = area / muUnit;
                content += resultMu.toFixed(2) + units[3];
            }
            // content += area < acre ? area.toFixed(0) + units[2] : (area / acre).toFixed(2) + units[3];
        } else {
            //英文显示英亩 = 1英亩= 4046.8564224平方米
            var muUnit = 4046.8564224;
            if (area < muUnit) {
                content += area.toFixed(0) + units[0];
            } else {
                var resultMu = area / muUnit;
                content += resultMu.toFixed(2) + units[3];
            }
        }
    }
    return content;
};

window.MyAreaTool = MyAreaTool;



