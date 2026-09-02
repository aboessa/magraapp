import fs from 'fs'; import path from 'path';
const dir = 'app_main/assets/avatars/characters';
const map = {
  'luna.png': 'luna-full.png',
  'luna-calm.png': 'luna-full.png',
  'nouma.png': 'nouma-full.png',
  'nouma-like.png': 'nouma-smile.png',
  'nouma-angry.png': 'nouma-full.png',
  'nouma-surprised.png': 'nouma-smile.png',
  'zaina.png': 'zaina-front.png',
  'zaina-side.png': 'zaina-front.png',
  'zaina-magnify.png': 'zaina-front.png',
  'zaina-map.png': 'zaina-front.png',
  'yaseen.png': 'yaseen-front.png',
  'yaseen-side.png': 'yaseen-front.png',
  'yaseen-magnify.png': 'yaseen-front.png',
  'yaseen-map.png': 'yaseen-front.png',
  'yaseen-surprised.png': 'yaseen-front.png',
  'salma.png': 'nouma-full.png', // temp until salma generated
  'salma-full.png': 'nouma-full.png',
  'addaad.png': 'nouma-full.png',
  'addaad-happy.png': 'nouma-full.png',
  'addaad-confused.png': 'nouma-full.png',
  'addaad-thinking.png': 'nouma-thinking.png',
  'addaad-learning.png': 'nouma-thinking.png',
  'addaad-celebrating.png': 'luna-happy.png',
  'addaad-help.png': 'nouma-thinking.png',
  'robo.png': 'luna-full.png',
  'robo-analytical.png': 'luna-full.png',
  'robo-success.png': 'luna-happy.png',
  'robo-curious.png': 'luna-curious.png',
  'robo-debugging.png': 'luna-full.png',
  'robo-explaining.png': 'luna-full.png',
  'robo-warning.png': 'luna-full.png',
  'orbit.png': 'luna-full.png',
  'comet.png': 'yaseen-front.png',
  'nova.png': 'nouma-happy.png',
};

for(const [dst, src] of Object.entries(map)){
  const dstPath = path.join(dir, dst);
  const srcPath = path.join(dir, src);
  if(fs.existsSync(dstPath)) continue;
  if(fs.existsSync(srcPath)){
    fs.copyFileSync(srcPath, dstPath);
    console.log(`alias ${src} -> ${dst}`);
  }
}
console.log('done aliases');
