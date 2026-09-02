import fs from 'fs';
let t=fs.readFileSync('tools/playveo/complete-drawing.manifest.json','utf8');
t=t.replaceAll('"difficulty": "صعب"', '"difficulty": "مفصل"');
fs.writeFileSync('tools/playveo/complete-drawing.manifest.json', t);
console.log('manifest fixed');
let m=fs.readFileSync('dashboard/api/migrations/0069_complete_drawing_50.sql','utf8');
m=m.replaceAll("'صعب'","'مفصل'");
fs.writeFileSync('dashboard/api/migrations/0069_complete_drawing_50.sql', m);
console.log('migration fixed');
