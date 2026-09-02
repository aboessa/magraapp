#!/usr/bin/env node
/**
 * build-complete-drawing-prompts.mjs
 *
 * Adds an explicit `prompt_full` to every asset in complete-drawing.manifest.json.
 *
 * WHY THESE ARE HAND-WRITTEN, NOT DERIVED
 * ---------------------------------------
 * generate-complete-drawing.mjs built the reference prompt at runtime by regex —
 * stripping "light gray dashed ..." out of the challenge prompt (see its lines
 * 79-81). Two independent failures make that unusable:
 *
 *   1. It leaves half-sentences behind. "The right half is unfinished, showing
 *      only very light gray dashed guides matching the missing wings" collapses to
 *      "The right half is unfinished, showing only".
 *   2. Deleting the missing-part sentence does NOT produce a complete subject. The
 *      surviving sentence still says "Front half including hood, front wheel,
 *      windshield and headlight is fully colored" — so the reference would render a
 *      car with no back half. A first attempt at mechanical rewrites produced
 *      "left all of the colorful shell" and "fully illustrated and colored and
 *      colored".
 *
 * The reference image is the child's answer key. Every prompt below therefore
 * describes the WHOLE subject explicitly, and each one names the parts the
 * challenge leaves as dashed guides so the pair stays in sync.
 *
 * Idempotent. Usage:
 *   node tools/playveo/build-complete-drawing-prompts.mjs          # dry run
 *   node tools/playveo/build-complete-drawing-prompts.mjs --write
 */
import fs from 'node:fs';
import path from 'node:path';

const MANIFEST = path.join(import.meta.dirname, 'complete-drawing.manifest.json');
const WRITE = process.argv.includes('--write');

const TAIL =
  ' This is the finished answer-key reference: the subject is whole and complete, ' +
  'fully colored and polished on every side, symmetrical and balanced where the ' +
  'subject is symmetrical. Every part is drawn and filled with color. No dashed ' +
  'lines, no gray guides, no construction lines, no faint outlines, no unfinished ' +
  'or missing parts.';

/// id -> description of the COMPLETE subject. Mirrors each challenge prompt part
/// for part, with the missing side filled in.
const FULL = {
  'butterfly-01':
    'A cute colorful butterfly viewed straight from the front, perfectly symmetrical. Both wings are completely finished in pink, purple, yellow and turquoise, with matching decorative circles on each wing, a smiling yellow body and clean bold outlines.',
  'bird-01':
    'A cute blue and yellow bird sitting on a brown branch. The head, chest, both wings, the full tail and the complete branch with all of its green leaves are fully colored and finished.',
  'cat-01':
    'A cute orange kitten sitting and facing forward, perfectly symmetrical. Both ears, both eyes, the whole body and both front paws are fully illustrated and colored.',
  'fish-01':
    'A cheerful turquoise tropical fish facing sideways. The head, body, top fin, lower fin and the complete tail fin are all fully colored.',
  'rabbit-01':
    'A cute white rabbit sitting upright. The head, body, both long ears, both paws and the round fluffy tail are all finished and colored.',
  'panda-01':
    'A friendly panda sitting with a bamboo branch. The head, body, both arms and both legs are fully completed, and the bamboo branch carries its full set of green leaves.',
  'lion-01':
    'A cheerful baby lion sitting front-facing, perfectly symmetrical. The complete round orange mane, the whole face and the entire body are fully colored.',
  'giraffe-01':
    'A cute young giraffe standing sideways. Head, long neck, front legs, rear legs, the whole body and the tail are fully colored, with large brown spots across the entire body.',
  'turtle-01':
    'A friendly green turtle viewed from the side. The head, all four legs and the complete colorful shell with its full repeating pattern are finished.',
  'dino-01':
    'A friendly green baby dinosaur viewed from the side. Head, body, front legs, rear legs, the long tail and the complete row of large back spikes are finished in bright colors.',
  'rocket-01':
    'A cute red and white rocket pointing upward, perfectly symmetrical. The whole rocket is colored, with a blue circular window, matching red fins on both sides and an orange-yellow flame beneath.',
  'planet-ring-01':
    'A colorful purple planet with a bright ring. The whole planet and the complete ring encircling it are fully illustrated.',
  'moon-star-01':
    'A cute yellow crescent moon with a friendly smiling face, three finished stars around it and one small white cloud, everything fully colored.',
  'ufo-01':
    'A friendly purple and blue flying saucer viewed from the front, perfectly symmetrical. The whole glass dome, the entire body and the landing lights on both sides are fully colored.',
  'astronaut-01':
    'A cute child astronaut floating in space. Helmet, torso, both arms, both legs and the backpack are fully colored.',
  'rover-01':
    'A cute orange and white moon rover. Cabin, body, front wheels, rear wheels, the antenna and the small equipment box are all finished.',
  'station-01':
    'A simplified colorful space station. The central module, both matching solar panels, the antenna and the small docking module are completely illustrated.',
  'alien-planet-01':
    'A colorful alien planet landscape with purple hills across the whole scene, six strange plants, one moon and a curved ring in the sky, everything fully colored.',
  'flower-01':
    'A large beautiful pink flower viewed from the front, perfectly symmetrical. All six petals, the yellow center and both green leaves are fully colored.',
  'tree-01':
    'A cheerful green tree with a brown trunk. The trunk, the branches and the complete rounded canopy are fully colored, with five red apples.',
  'rainbow-01':
    'A bright five-band rainbow arcing between two finished fluffy white clouds, every band fully colored.',
  'sun-cloud-01':
    'A cheerful yellow sun with the complete ring of rays all around it fully drawn and colored, and one white cloud beside it.',
  'palm-01':
    'A tropical palm tree with a brown trunk and a full crown of green leaves spreading all around, plus two brown coconuts, everything fully finished.',
  'mountain-01':
    'A simple colorful landscape with two completed mountains, the sun, two pine trees and a small lake edge, all fully colored.',
  'waterfall-01':
    'A stylized waterfall scene with green cliffs on both sides, blue falling water, rocks, plants and the complete pool edge, all fully colored.',
  'garden-01':
    'A cheerful garden scene with five finished colorful flowers, a complete fence running across the scene, a butterfly and a watering can, everything fully colored.',
  'car-01':
    'A cute red cartoon car viewed from the side. The complete body including hood, windshield, both doors, trunk, headlight and both wheels is fully colored.',
  'sailboat-01':
    'A colorful small sailboat on blue waves. The boat hull, both triangular sails and the complete row of waves are fully finished.',
  'balloon-01':
    'A cheerful hot air balloon, perfectly symmetrical, with the whole balloon colored in orange, yellow and turquoise bands and the basket complete.',
  'plane-01':
    'A friendly blue passenger airplane flying sideways. Nose, cockpit, the whole body, both wings and the tail are fully finished.',
  'train-01':
    'A colorful toy-like train engine pulling two completed carriages, with every wheel and both connecting sections fully colored.',
  'firetruck-01':
    'A bright red cartoon fire truck. Cab, main body, both wheels, the ladder and the hose section are completed.',
  'excavator-01':
    'A yellow construction excavator. Cabin, tracks, the complete mechanical arm and the large digging bucket are fully colored.',
  'submarine-01':
    'A cheerful yellow submarine underwater. Front body, rear body, two circular windows, top periscope, tail fin, propeller and several bubbles are fully colored.',
  'house-01':
    'A cute small house viewed from the front, perfectly symmetrical. The complete roof, both windows, the whole wall, the door and flowers on both sides are fully colored.',
  'cupcake-01':
    'A colorful pink cupcake. The wrapper, the complete swirl of frosting, a red cherry on top and colorful sprinkle decorations are all completely finished.',
  'teddy-01':
    'A friendly brown teddy bear sitting front-facing, perfectly symmetrical. Both ears, both eyes, both arms, both legs and the whole belly are fully colored.',
  'backpack-01':
    'A colorful turquoise and purple child backpack. The main bag body, both straps, the side pocket and the zipper decoration are fully illustrated.',
  'art-table-01':
    'A simple child art table with a finished sketchbook, a cup of colored pencils, a small lamp, a paint palette and the complete desk, all fully colored.',
  'kids-room-01':
    'A cozy colorful child bedroom with bed, pillow, bedside table, window, lamp, rug and toy box, everything fully finished.',
  'playground-01':
    'A cheerful playground with a completed colorful slide, a tree, a swing set, a small climbing structure and green grass, all fully colored.',
  'apple-01':
    'A large shiny red apple, perfectly symmetrical and completely colored, with a green leaf and a brown stem on top.',
  'icecream-01':
    'A cheerful ice cream cone with the cone and three colorful scoops completed, topped with a red cherry and small colorful decorations.',
  'fruit-basket-01':
    'A colorful fruit basket holding a finished apple, banana, orange, pear and a bunch of grapes, with the complete basket and its handle fully colored.',
  'pizza-01':
    'A round cheerful pizza, whole and complete, fully colored with simple tomato, mushroom and pepper toppings spread evenly across the entire pizza.',
  'unicorn-01':
    'A cute magical white unicorn. Head, body, front legs, rear legs, the colorful flowing mane, the long flowing tail and several small stars are fully finished.',
  'dragon-01':
    'A friendly green baby dragon sitting. Head, body, both wings, front legs, the curled tail and the complete row of back spikes are fully colored.',
  'castle-01':
    'A colorful fantasy castle, perfectly symmetrical, with the central tower, both side towers, both walls and several white clouds fully illustrated in purple, blue and gold.',
  'cloud-house-01':
    'A whimsical tiny house resting on a fluffy cloud. The house, door, both windows, the complete roof, the whole cloud and floating stars are fully colored.',
  'floating-island-01':
    'A magical floating island with green grass, two trees, a small waterfall, the complete rocky underside, rock formations and a cloud, everything fully colored.',
};

const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));

const ids = manifest.assets.map((a) => a.id);
const missing = ids.filter((id) => !FULL[id]);
const extra = Object.keys(FULL).filter((id) => !ids.includes(id));
if (missing.length || extra.length) {
  console.error(`ids without a prompt: ${missing.join(', ') || 'none'}`);
  console.error(`prompts without an id: ${extra.join(', ') || 'none'}`);
  process.exit(1);
}

let bad = 0;
for (const a of manifest.assets) {
  const body = FULL[a.id];
  // A reference prompt that mentions guides or partial coverage is a bug: it would
  // render an unfinished answer key. Catch it before paying to render it.
  const leak = body.match(/dashed|unfinished|missing|left half|right half|half of/i);
  if (leak) {
    bad++;
    console.error(`!! ${a.id}: reference prompt contains "${leak[0]}"`);
  }
  a.prompt_full = (body + TAIL).replace(/\s+/g, ' ').trim();
  console.log(`── ${a.id} (${a.group}/${a.difficulty}${a.tag ? '/' + a.tag : ''}) ${a.prompt_full.length} chars`);
}

console.log(`\n${manifest.assets.length} assets, ${bad} invalid.`);
if (bad > 0) process.exit(1);

if (WRITE) {
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`✅ wrote prompt_full into ${path.basename(MANIFEST)}`);
} else {
  console.log('(dry run — pass --write to persist)');
}
