import fs from 'fs';
const p = 'src/app/features/page.tsx';
let s = fs.readFileSync(p, 'utf8');
const marker = 'import FeaturesClient from "./FeaturesClient";';
let idx = -1, count = 0;
while ((idx = s.indexOf(marker, idx + 1)) !== -1) {
  console.log('found at', idx);
  count++;
}
console.log('count', count);
console.log('file length', s.length);
console.log('---slice around first occurrence---');
const first = s.indexOf(marker);
if (first !== -1) console.log(s.slice(Math.max(0, first-40), first+marker.length+240));
else console.log('no first occurrence');
