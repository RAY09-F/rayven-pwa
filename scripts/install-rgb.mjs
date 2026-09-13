import {mkdirSync,writeFileSync,copyFileSync} from 'node:fs';
import {join} from 'node:path';

const target=join(process.env.LOCALAPPDATA,'ASGARD-RGB');mkdirSync(target,{recursive:true});
copyFileSync(new URL('./rgb-companion.mjs',import.meta.url),join(target,'rgb-companion.mjs'));
const effects=join(process.env.USERPROFILE,'Documents','WhirlwindFX','Effects');mkdirSync(effects,{recursive:true});
copyFileSync(new URL('./effects/ASGARD Flow.html',import.meta.url),join(effects,'ASGARD Flow.html'));
copyFileSync(new URL('./desktop-local.mjs',import.meta.url),join(target,'desktop-local.mjs'));
const vbs='Set shell = CreateObject("WScript.Shell")\r\nshell.Run Chr(34) & "'+process.execPath+'" & Chr(34) & " " & Chr(34) & "'+join(target,'rgb-companion.mjs')+'" & Chr(34), 0, False\r\n';
writeFileSync(join(target,'Start ASGARD Lights.vbs'),vbs);
const startup=join(process.env.APPDATA,'Microsoft','Windows','Start Menu','Programs','Startup');
writeFileSync(join(startup,'ASGARD Lights.vbs'),vbs);
console.log('Installed local lighting helper, Flow effect (restart SignalRGB to discover it), and Windows sign-in startup.');
