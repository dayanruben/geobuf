
import {test} from 'node:test';
import * as assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {writeFileSync, unlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {featurecollection} from '@mapbox/geojson-fixtures';

const fixtureJSON = featurecollection.one;

const json2geobufBin = new URL('../bin/json2geobuf.js', import.meta.url).pathname;
const geobuf2jsonBin = new URL('../bin/geobuf2json.js', import.meta.url).pathname;

function json2geobuf(input) {
    const r = spawnSync(process.execPath, [json2geobufBin], {
        input: typeof input === 'string' ? input : JSON.stringify(input)
    });
    assert.equal(r.status, 0, r.stderr.toString());
    return r.stdout;
}

function geobuf2json(input) {
    const r = spawnSync(process.execPath, [geobuf2jsonBin], {input});
    assert.equal(r.status, 0, r.stderr.toString());
    return JSON.parse(r.stdout.toString());
}

test('json2geobuf + geobuf2json round-trip via stdin', () => {
    assert.deepEqual(geobuf2json(json2geobuf(fixtureJSON)), fixtureJSON);
});

test('json2geobuf file argument', () => {
    const tmpFile = `${tmpdir()}/geobuf-cli-input.json`;
    writeFileSync(tmpFile, JSON.stringify(fixtureJSON));
    try {
        const r = spawnSync(process.execPath, [json2geobufBin, tmpFile]);
        assert.equal(r.status, 0, r.stderr.toString());
        assert.deepEqual(geobuf2json(r.stdout), fixtureJSON);
    } finally {
        unlinkSync(tmpFile);
    }
});

test('geobuf2json file argument', () => {
    const tmpFile = `${tmpdir()}/geobuf-cli-test.pbf`;
    writeFileSync(tmpFile, json2geobuf(fixtureJSON));
    try {
        const r = spawnSync(process.execPath, [geobuf2jsonBin, tmpFile]);
        assert.equal(r.status, 0, r.stderr.toString());
        assert.deepEqual(JSON.parse(r.stdout.toString()), fixtureJSON);
    } finally {
        unlinkSync(tmpFile);
    }
});
