#!/usr/bin/env node

import {encode} from '../encode.js';
import Pbf from 'pbf';
import shapefile from 'shapefile';

const geojson = await shapefile.read(process.argv[2]);
process.stdout.write(Buffer.from(encode(geojson, new Pbf())));
