import test from 'node:test';import assert from 'node:assert/strict';import {safeError} from '../src/lib/chat-diagnostics.js';
test('diagnostics remove provider credentials, bot tokens, URLs and labeled secrets',()=>{
 const values=['sk-ant-'+ 'x'.repeat(40),'123456789:'+ 'a'.repeat(35),'ghp_'+ 'a'.repeat(36),'https://example.test/?secret=private'];
 for(const value of values)assert.ok(!safeError(Error('Failed: '+value)).includes(value));
 assert.equal(safeError('api_key=private password:secret'),'api_key=[redacted] password:[redacted]');
 assert.equal(safeError('x'.repeat(1000)).length,500);
});
