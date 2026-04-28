#!/usr/bin/env node

import {encode} from '../encode.js';
import Pbf from 'pbf';
import {createReadStream} from 'node:fs';
import {buffer} from 'node:stream/consumers';

const input = process.argv[2] ? createReadStream(process.argv[2]) : process.stdin;
const buf = await buffer(input);
const geojson = JSON.parse(buf.toString());
process.stdout.write(Buffer.from(encode(geojson, new Pbf())));
