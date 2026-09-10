import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {buildServiceSample,outputPath} from './build-service-sample.mjs';
test('standalone sample is reproducible and current with its source',async () => {
  const built = await buildServiceSample();
  assert.equal(await readFile(outputPath,'utf8'),built,'Run node scripts/build-service-sample.mjs after editing the sample.');
  assert.doesNotMatch(built,/\b(?:href|src)="(?!#)[^"]*"/);
  assert.match(built,/FICTIONAL BUSINESS/);
  assert.match(built,/id="about-sample"/);
  assert.match(built,/connect-src 'none'/);
});
test('standalone CSP hashes exactly authorize bundled style and interactive script',async () => {
  const html = await buildServiceSample();
  for(const tag of ['script','style']) {
    const content = html.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))[1];
    const hash = createHash('sha256').update(content).digest('base64');
    assert.ok(html.includes(`${tag}-src 'sha256-${hash}'`));
  }
  assert.doesNotMatch(html,/unsafe-inline|unsafe-eval/);
});
