// Content fingerprint, independent of the commit that contains this generated manifest.
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const files=['public/index.html','public/hud/index.html'];
async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const p=`${dir}/${entry.name}`;if(entry.isDirectory())await walk(p);else if(entry.name!=='release.json')files.push(p);}}
await walk('public/ui');files.sort();
const assets={};for(const file of files)assets[file.replace('public','')]=createHash('sha256').update(await readFile(file)).digest('hex');
const fingerprint=createHash('sha256').update(JSON.stringify(assets)).digest('hex');
const release={name:'The Floating Realms',id:`floating-${fingerprint.slice(0,12)}`,sourceBase:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),fingerprint,assets};
await writeFile('public/ui/release.json',JSON.stringify(release,null,2)+'\n');
console.log(`${release.id}: ${files.length} assets fingerprinted`);
