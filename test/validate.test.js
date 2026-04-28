
import * as geobuf from '../index.js';
import {all as geojsonFixtures} from '@mapbox/geojson-fixtures';
import Pbf from 'pbf';
import {test} from 'node:test';
import * as assert from 'node:assert/strict';
import {readFileSync} from 'fs';

for (const name in geojsonFixtures) {
    if (name === 'polygon-xyz-0-7') continue; // missing coord data not supported yet
    test(`roundtrip GeoJSON: ${name}`, roundtripTest(geojsonFixtures[name]));
}

test('roundtrip issue', roundtripTest(getJSON('issue62.json')));

test('roundtrip custom properties', roundtripTest(getJSON('props.json')));
test('roundtrip issue55', roundtripTest(getJSON('issue55.json')));
test('roundtrip issue90', roundtripTest(getJSON('issue90.json')));
test('roundtrip single-ring MultiPolygon', roundtripTest(getJSON('single-multipoly.json')));

test('roundtrip valid closed polygon with high-precision coordinates', () => {
    const geojson = getJSON('precision.json');
    const pbf = new Pbf(geobuf.encode(geojson, new Pbf()));
    const ring = geobuf.decode(pbf).features[0].geometry.coordinates[0];
    assert.deepEqual(ring[0], ring[4]);
});

test('roundtrip a line with potential accumulating error', () => {
    // Generate a line of 40 points. Each point's x coordinate, x[n] is at x[n - 1] + 1 + d, where
    // d is a floating point number that just rounds to 0 at 6 decimal places, i.e. 0.00000049.
    // Therefore a delta compression method that only computes x[n] - x[n - 1] and rounds to 6 d.p.
    // will get a constant delta of 1.000000. The result will be an accumulated error along the
    // line of 0.00000049 * 40 = 0.0000196 over the full length.
    const feature = {
        'type': 'MultiPolygon',
        'coordinates': [[[]]]
    };
    const points = 40;
    // X coordinates [0, 1.00000049,  2.00000098,  3.00000147,  4.00000196, ...,
    //                  37.00001813, 38.00001862, 39.00001911, 40.00001960, 0]
    for (let i = 0; i <= points; i++) {
        feature.coordinates[0][0].push([i * 1.00000049, 0]);
    }
    feature.coordinates[0][0].push([0, 0]);
    const roundTripped = geobuf.decode(new Pbf(geobuf.encode(feature, new Pbf())));
    function roundX(z) {
        return Math.round(z[0] * 1000000) / 1000000.0;
    }
    const xsOrig = feature.coordinates[0][0].map(roundX);
    const xsRoundTripped = roundTripped.coordinates[0][0].map(roundX);
    assert.deepEqual(xsRoundTripped, xsOrig);
});

test('roundtrip a circle with potential accumulating error', () => {
    // Generate an approximate circle with 16 points around.
    const feature = {
        'type': 'MultiPolygon',
        'coordinates': [[[]]]
    };
    const points = 16;
    for (let i = 0; i <= points; i++) {
        feature.coordinates[0][0].push([
            Math.cos(Math.PI * 2.0 * i / points),
            Math.sin(Math.PI * 2.0 * i / points)
        ]);
    }
    const roundTripped = geobuf.decode(new Pbf(geobuf.encode(feature, new Pbf())));
    function roundCoord(z) {
        let x = Math.round(z[0] * 1000000);
        let y = Math.round(z[1] * 1000000);
        // handle negative zero case (tape issue)
        if (x === 0) x = 0;
        if (y === 0) y = 0;
        return [x, y];
    }
    const ringOrig = feature.coordinates[0][0].map(roundCoord);
    const ringRoundTripped = roundTripped.coordinates[0][0].map(roundCoord);
    assert.deepEqual(ringRoundTripped, ringOrig);
});

function roundtripTest(geojson) {
    return function () {
        const buf = geobuf.encode(geojson, new Pbf());
        const geojson2 = geobuf.decode(new Pbf(buf));
        assert.deepEqual(geojson2, geojson);
    };
}

function getJSON(name) {
    return JSON.parse(readFileSync(new URL(`fixtures/${name}`, import.meta.url)));
}
