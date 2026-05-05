import fs from 'fs';
const p = 'src/app/features/page.tsx';
let s = fs.readFileSync(p, 'utf8');
const marker = 'import FeaturesClient from "./FeaturesClient";';
const first = s.indexOf(marker);
if (first === -1) {
  console.log('Marker not found; nothing to do.');
  process.exit(0);
}
const second = s.indexOf(marker, first + marker.length);
if (second === -1) {
  console.log('No duplicate block found; nothing to do.');
  process.exit(0);
}
const newContent = s.substring(0, second).trimEnd() + '\n';
fs.writeFileSync(p, newContent, 'utf8');
console.log('Deduped', p, '— removed', (s.length - newContent.length), 'bytes');
