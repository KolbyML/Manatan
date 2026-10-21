import assert from 'node:assert/strict';
import {readFile,access,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
execFileSync(process.execPath,[path.join(root,'scripts/build-readmes.mjs'),'--check'],{stdio:'inherit'});
const files=['README.md',...(await readdir(path.join(root,'docs/readme'))).filter(name=>/^README\..+\.md$/.test(name)).map(name=>`docs/readme/${name}`)];
assert.equal(files.length,17);
let checkedPaths=0;
const expectedExternal=new Set();
for(const [index,file] of files.entries()){
  const text=await readFile(path.join(root,file),'utf8');
  assert.ok(text.includes('Linux%20%7C%20Web-lightgrey'),`${file}: platform badge must include Web`);
  assert.match(text,/\[TestFlight\]\(https:\/\/discord\.gg\/tDAtpPN8KK\)/,`${file}: beta invite must point to Discord`);
  assert.match(text,/\[App Store\]\(https:\/\/apps\.apple\.com\/app\/manatan\/id6756917436\)/);
  assert.ok(!text.includes('testflight.apple.com/join'),`${file}: do not bypass the Discord beta invitation`);
  assert.match(text,/https:\/\/manatan\.com\/account\/lists/);
  assert.match(text,/https:\/\/manatan\.com\/srs\//);
  assert.match(text,/https:\/\/manatan\.com\/japanese-learning-resources/);
  assert.equal((text.match(/<h1>/g)||[]).length,1);
  assert.equal((text.match(/<details>/g)||[]).length,(text.match(/<\/details>/g)||[]).length);
  assert.ok(!text.includes('<details>'),`${file}: screenshots must stay visible`);
  assert.ok(!text.includes('https://manatan.com/privacy'),`${file}: removed privacy section must not return`);
  assert.match(text,/- \[Suwayomi Server\]\([^\n]+\)\n- \[Suwayomi WebUI\]\([^\n]+\)\n- \[hoshidicts\]\([^\n]+\)/,`${file}: acknowledgements must be a vertical list`);
  assert.match(text,/https:\/\/api\.star-history\.com\/svg\?repos=KolbyML\/Manatan&type=date&legend=top-left/);
  assert.ok(text.replace(/<\/div>\s*$/,'').trimEnd().endsWith('](https://www.star-history.com/#KolbyML/Manatan&type=date&legend=top-left)'),`${file}: star history must remain at the bottom`);
  const local=[];
  const external=[];
  for(const match of text.matchAll(/\]\(([^)]+)\)|(?:src|href)="([^"]+)"/g)){
    const value=match[1]||match[2];
    if(value.startsWith('https://')){if(!value.startsWith('https://img.shields.io'))external.push(value);}
    else if(!value.startsWith('#'))local.push(value);
  }
  const selectors=local.filter(value=>/README(?:\.[\w-]+)?\.md$/.test(value));
  assert.equal(new Set(selectors).size,16,`${file}: every other language must be reachable`);
  for(const value of new Set(local)){
    const target=path.resolve(path.dirname(path.join(root,file)),value);
    assert.ok(target.startsWith(root+path.sep),`${file}: local path escapes repository`);
    await access(target);checkedPaths++;
  }
  const linkSet=new Set(external);
  if(index===0)for(const value of linkSet)expectedExternal.add(value);
  else assert.deepEqual([...linkSet].sort(),[...expectedExternal].sort(),`${file}: translated links differ from English`);
  if(file.endsWith('README.ar.md')){
    assert.equal((text.match(/dir="rtl"/g)||[]).length,2);
    assert.ok(!text.includes('style=for-the-badge'),'Use native Arabic links to preserve letter shaping');
  }
  if(file==='README.md'){
    assert.ok(!/\bfree\b/i.test(text),'Do not market the README around free');
    assert.match(text,/A dictionary is installed automatically\./);
    assert.ok(!text.includes('then import a dictionary'));
    assert.ok(!text.includes('Cloud services and privacy'));
  }
}
console.log(`Passed: ${files.length} READMEs, ${checkedPaths} local paths, identical public destinations, platform badge, Discord beta access, and Arabic direction.`);
