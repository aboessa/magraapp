/**
 * Real HTTP round-trip for the drawing chain.
 *
 * Exercises: register -> child -> GET /api/v1/games/:id -> runtime pack ->
 * POST /api/v1/family/progress (a trace attempt) -> GET /api/v1/family/mastery.
 *
 * ## What this proves that unit tests cannot
 *
 * The unit tests validate packs and score strokes in isolation. This asserts the
 * wiring: that a published pack is actually served over HTTP with its geometry
 * intact, that the attempt the Flutter engine would send is accepted, and that it
 * moves the mastery ladder.
 *
 * ## Why a fixture
 *
 * It targets `game-fixture-trace-circle` on a `test_fixture` series (migration
 * 0028). No real pack was published to make this pass: they are all correctly
 * draft, and `contentClass.ts` excludes fixtures from production regardless.
 *
 * Usage:
 *   npx wrangler dev          # in another shell
 *   node scripts/verify-drawing-e2e.mjs [baseUrl]
 */

const BASE = process.argv[2] ?? 'http://127.0.0.1:8787';
const GAME_ID = 'game-fixture-trace-circle';
const OBJECTIVE_ID = 'objective-world-shape-trace_form';

let failures = 0;
function check(name, ok, detail) {
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(`${mark}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
  return ok;
}

async function call(path, { method = 'GET', body, token } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await response.json().catch(() => null);
  return { status: response.status, json };
}

async function main() {
  console.log(`# drawing end-to-end against ${BASE}\n`);

  const health = await call('/api/v1/site-mode');
  if (!check('dev server reachable', health.status < 500, `status ${health.status}`)) {
    console.log('\nStart the worker first:  npx wrangler dev');
    process.exit(1);
  }

  // 1. A parent account. Unique email so repeated runs do not collide.
  //
  // Registration deliberately does not hand back a session: the address must be
  // verified first. Dev returns the verification token in the response so this
  // flow can be exercised without a mailbox.
  //
  // `/api/v1/auth/*` allows 5 requests per 60s and this flow costs three, so a run
  // straight after another script's run can exhaust it. Retried once after the
  // window rather than failing, so the two scripts can run back to back.
  const password = 'Correct-Horse-9';
  let token = null;
  for (let attempt = 0; attempt < 2 && !token; attempt++) {
    const stamp = Date.now();
    const email = `drawing-e2e-${stamp}@example.test`;
    const installation = `e2e-${stamp}`;
    const registered = await call('/api/v1/auth/register', {
      method: 'POST',
      body: { email, password, display_name: 'أسرة تحقّق', installation_id: installation, platform: 'android' },
    });
    const verificationToken = registered.json?.data?.development_verification_token;

    if (verificationToken) {
      await call('/api/v1/auth/verify-email', { method: 'POST', body: { token: verificationToken } });
      const loggedIn = await call('/api/v1/auth/login', {
        method: 'POST',
        body: { email, password, installation_id: installation, platform: 'android', device_name: 'هاتف' },
      });
      token = loggedIn.json?.data?.access_token ?? null;
      if (token) break;
      if (loggedIn.status !== 429) {
        check('parent holds an access token', false, `status ${loggedIn.status}`);
        console.log(JSON.stringify(loggedIn.json, null, 2));
        process.exit(1);
      }
    } else if (registered.status !== 429) {
      check('parent registered', false, `status ${registered.status}`);
      console.log(JSON.stringify(registered.json, null, 2));
      process.exit(1);
    }

    if (attempt === 0) {
      console.log('      auth rate limit reached; waiting 62s for the window to reset');
      await new Promise((resolve) => setTimeout(resolve, 62_000));
    }
  }
  if (!check('parent registered, verified and holds an access token', Boolean(token))) {
    process.exit(1);
  }

  // 2. A child in the right age band for the fixture (3-5).
  const year = new Date().getUTCFullYear() - 4;
  const child = await call('/api/v1/family/children', {
    method: 'POST', token,
    body: { nickname: 'سلمى', birth_month: 5, birth_year: year, avatar_id: 'avatar-1', language: 'ar' },
  });
  const childId = child.json?.data?.id;
  if (!check('child profile created', Boolean(childId), `status ${child.status}`)) {
    console.log(JSON.stringify(child.json, null, 2));
    process.exit(1);
  }

  // 3. The published pack, over HTTP.
  const game = await call(`/api/v1/games/${GAME_ID}?child_id=${childId}`, { token });
  const data = game.json?.data;
  check('GET /api/v1/games/:id returns the published game', game.status === 200,
    `status ${game.status}`);
  check('engine id is trace_color', data?.engine_id === 'trace_color', String(data?.engine_id));
  check('runtime pack carries stroke geometry',
    Array.isArray(data?.content_pack?.levels?.[0]?.stroke_paths?.[0]?.points) &&
    data.content_pack.levels[0].stroke_paths[0].points.length > 3,
    `${data?.content_pack?.levels?.[0]?.stroke_paths?.[0]?.points?.length ?? 0} points`);
  check('tolerance and coverage are present',
    data?.content_pack?.levels?.[0]?.tolerance_dp === 28 &&
    data?.content_pack?.levels?.[0]?.coverage_required === 0.8);
  check('accessibility travels with the pack',
    data?.accessibility?.simplified_motor?.tolerance_dp === 44 &&
    data?.accessibility?.sequential_tap_alternative === true);
  check('the prompt is resolved for the served language',
    typeof data?.content_pack?.levels?.[0]?.prompt === 'string' &&
    data.content_pack.levels[0].prompt.length > 0,
    data?.language);
  check('editorial review state is stripped', data?.content_pack?.review === undefined);
  check('objective and skills accompany the pack',
    data?.objective?.code === 'world.shape.trace_form' && Array.isArray(data?.skills) &&
    data.skills.length > 0,
    `${data?.skills?.length ?? 0} skills`);
  check('the engine is declared pointer-only', data?.engine?.supports_dpad === false);
  // Assets exist and are `ready` but have no r2_key, so no token can be minted.
  // Reporting them as unavailable is the honest outcome.
  check('unproduced audio is reported, not faked',
    Array.isArray(data?.assets?.unavailable) && data.assets.unavailable.length > 0,
    `${data?.assets?.unavailable?.length ?? 0} unavailable`);

  // 4. A French request must serve French, proving localisation over the wire.
  const french = await call(`/api/v1/games/${GAME_ID}?child_id=${childId}&language=fr`, { token });
  check('a French request is served in French',
    french.json?.data?.language === 'fr' &&
    /cercle/i.test(french.json?.data?.content_pack?.levels?.[0]?.prompt ?? ''),
    french.json?.data?.content_pack?.levels?.[0]?.prompt);
  check('geometry is identical across languages',
    JSON.stringify(french.json?.data?.content_pack?.levels?.[0]?.stroke_paths) ===
    JSON.stringify(data?.content_pack?.levels?.[0]?.stroke_paths));

  // 5. A draft pack must never be served, whatever is asked for.
  const draft = await call(`/api/v1/games/game-letter-tracing?child_id=${childId}`, { token });
  check('a draft game is not served', draft.status === 404, `status ${draft.status}`);

  // 6. The attempt the Flutter engine would send. Three clean runs, because
  // `independent` requires a streak rather than a single success.
  for (let run = 1; run <= 3; run++) {
    const attempt = await call('/api/v1/family/progress', {
      method: 'POST', token,
      body: {
        child_id: childId,
        content_type: 'game',
        content_id: GAME_ID,
        game_id: GAME_ID,
        objective_id: OBJECTIVE_ID,
        event_id: `e2e-attempt-${run}`,
        position_ms: 0,
        duration_ms: 0,
        completed: true,
        score: 1,
        max_score: 1,
        answers: [{ stroke: 's1', coverage: 0.94, deviation_dp: 7, completed: true, help_level: 0 }],
        time_spent: 25,
        help_used: false,
      },
    });
    check(`attempt ${run} accepted`, attempt.status === 200 && attempt.json?.data?.accepted !== false,
      `status ${attempt.status}`);
  }

  // 7. Idempotency: replaying an event id must not add an attempt.
  const replay = await call('/api/v1/family/progress', {
    method: 'POST', token,
    body: {
      child_id: childId, content_type: 'game', content_id: GAME_ID, game_id: GAME_ID,
      objective_id: OBJECTIVE_ID, event_id: 'e2e-attempt-3',
      position_ms: 0, duration_ms: 0, completed: true,
      score: 1, max_score: 1,
      answers: [{ stroke: 's1', coverage: 0.94, deviation_dp: 7, completed: true, help_level: 0 }],
      time_spent: 25, help_used: false,
    },
  });
  check('replaying an event id is idempotent', replay.status === 200, `status ${replay.status}`);

  // 8. Mastery moved, and reached `independent` on three unassisted successes.
  const mastery = await call(`/api/v1/family/mastery?child_id=${childId}`, { token });
  const row = (mastery.json?.data ?? []).find((entry) => entry.objective_id === OBJECTIVE_ID);
  check('mastery exists for the objective', Boolean(row), JSON.stringify(mastery.json?.data));
  check('three clean attempts reach independent', row?.level === 'independent', String(row?.level));
  check('the replayed attempt was not counted twice', Number(row?.attempts) === 3,
    `attempts ${row?.attempts}`);

  // 9. Progress is readable back, which is what "continue" depends on.
  const progress = await call(`/api/v1/family/progress?child_id=${childId}`, { token });
  const gameProgress = (progress.json?.data ?? []).find((entry) => entry.content_id === GAME_ID);
  check('game progress is readable', Boolean(gameProgress) && gameProgress.completed === 1,
    JSON.stringify(gameProgress));

  // 10. A child id the caller does not own is refused.
  //
  // Tested with the authenticated token and a foreign child id rather than by
  // registering a second family: registration is rate limited, and this exercises
  // the same guard - ownership is resolved through FamilyDO, so a well-formed id
  // belonging to nobody in this family must not resolve.
  const foreignChild = '00000000-0000-4000-8000-000000000001';
  const foreignMastery = await call(`/api/v1/family/mastery?child_id=${foreignChild}`, { token });
  check('a foreign child id is refused for mastery', foreignMastery.status === 404,
    `status ${foreignMastery.status}`);
  const foreignGame = await call(`/api/v1/games/${GAME_ID}?child_id=${foreignChild}`, { token });
  check('a foreign child id is refused for a game', foreignGame.status === 404,
    `status ${foreignGame.status}`);
  const foreignProgress = await call(`/api/v1/family/progress?child_id=${foreignChild}`, { token });
  check('a foreign child id is refused for progress', foreignProgress.status === 404,
    `status ${foreignProgress.status}`);

  // 11. No token at all must not reach any of it.
  const anonymous = await call(`/api/v1/games/${GAME_ID}?child_id=${childId}`);
  check('an unauthenticated request is rejected', anonymous.status === 401,
    `status ${anonymous.status}`);

  console.log(`\n# ${failures === 0 ? 'all checks passed' : `${failures} check(s) failed`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('unexpected failure', error);
  process.exit(1);
});
