#!/usr/bin/env node

import {decode} from '../decode.js';
import Pbf from 'pbf';
import {createReadStream} from 'node:fs';
import {buffer} from 'node:stream/consumers';

const input = process.argv[2] ? createReadStream(process.argv[2]) : process.stdin;
const buf = await buffer(input);
const geojson = decode(new Pbf(buf));
process.stdout.write(Buffer.from(JSON.stringify(geojson)));
