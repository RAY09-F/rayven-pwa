import test from 'node:test';
import assert from 'node:assert/strict';
import {browserTransportAuthorized} from '../src/lib/browser-auth.js';
const token='test-pairing-'.repeat(6);
for(const path of ['/browser/poll','/browser/result'])test(`${path}: pairing fails closed and accepts only its dedicated header`,async()=>{
 const request=headers=>new Request('https://asgard.test'+path,{headers});
 for(const env of [{},{BROWSER_CONTROL_TOKEN:''},{BROWSER_CONTROL_TOKEN:'short'}])assert.equal(await browserTransportAuthorized(request({'X-Asgard-Browser':token}),env),false);
 const env={BROWSER_CONTROL_TOKEN:token};
 assert.equal(await browserTransportAuthorized(request({}),env),false);
 assert.equal(await browserTransportAuthorized(request({'X-Asgard-Admin':token}),env),false);
 assert.equal(await browserTransportAuthorized(request({'X-Asgard-Browser':token+'wrong'}),env),false);
 assert.equal(await browserTransportAuthorized(request({'X-Asgard-Browser':token}),env),true);
});
