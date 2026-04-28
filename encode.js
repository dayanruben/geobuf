
let keys, keysArr, dim, e;
const maxPrecision = 1e6;

const geometryTypes = {
    'Point': 0,
    'MultiPoint': 1,
    'LineString': 2,
    'MultiLineString': 3,
    'Polygon': 4,
    'MultiPolygon': 5,
    'GeometryCollection': 6
};

export function encode(obj, pbf) {
    keys = {};
    keysArr = [];
    dim = 0;
    e = 1;

    analyze(obj);

    e = Math.min(e, maxPrecision);
    const precision = Math.ceil(Math.log(e) / Math.LN10);

    for (const key of keysArr) pbf.writeStringField(1, key);
    if (dim !== 2) pbf.writeVarintField(2, dim);
    if (precision !== 6) pbf.writeVarintField(3, precision);

    if (obj.type === 'FeatureCollection') pbf.writeMessage(4, writeFeatureCollection, obj);
    else if (obj.type === 'Feature') pbf.writeMessage(5, writeFeature, obj);
    else pbf.writeMessage(6, writeGeometry, obj);

    keys = null;

    return pbf.finish();
}

function analyze(obj) {
    if (obj.type === 'FeatureCollection') {
        for (const feature of obj.features) analyze(feature);

    } else if (obj.type === 'Feature') {
        if (obj.geometry !== null) analyze(obj.geometry);
        for (const key in obj.properties) saveKey(key);

    } else if (obj.type === 'Point') analyzePoint(obj.coordinates);
    else if (obj.type === 'MultiPoint') analyzePoints(obj.coordinates);
    else if (obj.type === 'GeometryCollection') {
        for (const geom of obj.geometries) analyze(geom);
    } else if (obj.type === 'LineString') analyzePoints(obj.coordinates);
    else if (obj.type === 'Polygon' || obj.type === 'MultiLineString') analyzeMultiLine(obj.coordinates);
    else if (obj.type === 'MultiPolygon') {
        for (const polygon of obj.coordinates) analyzeMultiLine(polygon);
    }

    for (const key in obj) {
        if (!isSpecialKey(key, obj.type)) saveKey(key);
    }
}

function analyzeMultiLine(coords) {
    for (const line of coords) analyzePoints(line);
}

function analyzePoints(coords) {
    for (const point of coords) analyzePoint(point);
}

function analyzePoint(point) {
    dim = Math.max(dim, point.length);

    for (const coord of point) {
        while (Math.round(coord * e) / e !== coord && e < maxPrecision) e *= 10;
    }
}

function saveKey(key) {
    if (keys[key] === undefined) {
        keys[key] = keysArr.push(key) - 1;
    }
}

function writeFeatureCollection(obj, pbf) {
    for (const feature of obj.features) pbf.writeMessage(1, writeFeature, feature);
    writeProps(obj, pbf, true);
}

function writeFeature(feature, pbf) {
    if (feature.geometry !== null) pbf.writeMessage(1, writeGeometry, feature.geometry);

    if (feature.id !== undefined) {
        if (typeof feature.id === 'number' && feature.id % 1 === 0) pbf.writeSVarintField(12, feature.id);
        else pbf.writeStringField(11, feature.id);
    }

    if (feature.properties) writeProps(feature.properties, pbf);
    writeProps(feature, pbf, true);
}

function writeGeometry(geom, pbf) {
    pbf.writeVarintField(1, geometryTypes[geom.type]);

    const coords = geom.coordinates;

    if (geom.type === 'Point') writePoint(coords, pbf);
    else if (geom.type === 'MultiPoint') writeLine(coords, pbf, true);
    else if (geom.type === 'LineString') writeLine(coords, pbf);
    else if (geom.type === 'MultiLineString') writeMultiLine(coords, pbf);
    else if (geom.type === 'Polygon') writeMultiLine(coords, pbf, true);
    else if (geom.type === 'MultiPolygon') writeMultiPolygon(coords, pbf);
    else if (geom.type === 'GeometryCollection') {
        for (const g of geom.geometries) pbf.writeMessage(4, writeGeometry, g);
    }

    writeProps(geom, pbf, true);
}

function writeProps(props, pbf, isCustom) {
    const indexes = [];
    let valueIndex = 0;

    for (const key in props) {
        if (isCustom && isSpecialKey(key, props.type)) continue;
        pbf.writeMessage(13, writeValue, props[key]);
        indexes.push(keys[key]);
        indexes.push(valueIndex++);
    }
    pbf.writePackedVarint(isCustom ? 15 : 14, indexes);
}

function writeValue(value, pbf) {
    if (value === null) return;

    const type = typeof value;

    if (type === 'string') pbf.writeStringField(1, value);
    else if (type === 'boolean') pbf.writeBooleanField(5, value);
    else if (type === 'object') pbf.writeStringField(6, JSON.stringify(value));
    else if (type === 'number') {
        if (value % 1 !== 0) pbf.writeDoubleField(2, value);
        else if (value >= 0) pbf.writeVarintField(3, value);
        else pbf.writeVarintField(4, -value);
    }
}

function writePoint(point, pbf) {
    const coords = [];
    for (let i = 0; i < dim; i++) coords.push(Math.round(point[i] * e));
    pbf.writePackedSVarint(3, coords);
}

function writeLine(line, pbf) {
    const coords = [];
    populateLine(coords, line);
    pbf.writePackedSVarint(3, coords);
}

function writeMultiLine(lines, pbf, closed) {
    const len = lines.length;
    if (len !== 1) {
        const lengths = [];
        for (const line of lines) lengths.push(line.length - (closed ? 1 : 0));
        pbf.writePackedVarint(2, lengths);
    }
    const coords = [];
    for (const line of lines) populateLine(coords, line, closed);
    pbf.writePackedSVarint(3, coords);
}

function writeMultiPolygon(polygons, pbf) {
    const len = polygons.length;
    if (len !== 1 || polygons[0].length !== 1) {
        const lengths = [len];
        for (const polygon of polygons) {
            lengths.push(polygon.length);
            for (const ring of polygon) lengths.push(ring.length - 1);
        }
        pbf.writePackedVarint(2, lengths);
    }

    const coords = [];
    for (const polygon of polygons) {
        for (const ring of polygon) populateLine(coords, ring, true);
    }
    pbf.writePackedSVarint(3, coords);
}

function populateLine(coords, line, closed) {
    const len = line.length - (closed ? 1 : 0);
    const sum = new Array(dim).fill(0);
    for (let i = 0; i < len; i++) {
        for (let j = 0; j < dim; j++) {
            const n = Math.round(line[i][j] * e) - sum[j];
            coords.push(n);
            sum[j] += n;
        }
    }
}

function isSpecialKey(key, type) {
    if (key === 'type') return true;
    if (type === 'FeatureCollection') return key === 'features';
    if (type === 'Feature') return key === 'id' || key === 'properties' || key === 'geometry';
    if (type === 'GeometryCollection') return key === 'geometries';
    return key === 'coordinates';
}
