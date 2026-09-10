// Keep the static-module runtime in sync with the exact npm dependency.
import {readFile,writeFile,copyFile} from 'node:fs/promises';
for(const file of ['three.module.min.js','three.core.min.js'])await copyFile(`node_modules/three/build/${file}`,`public/ui/vendor/${file}`);
const controls=await readFile('node_modules/three/examples/jsm/controls/OrbitControls.js','utf8');
await writeFile('public/ui/vendor/OrbitControls.js',controls.replace("from 'three'","from './three.module.min.js'"));
await copyFile('node_modules/three/LICENSE','public/ui/vendor/THREE-LICENSE.txt');
console.log('Synced three.js and OrbitControls from npm.');
