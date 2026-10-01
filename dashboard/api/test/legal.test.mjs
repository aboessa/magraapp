import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

import { isLegalSlug, LEGAL_SLUGS, placeholdersIn } from '../src/lib/legalDocuments.ts';

/// Legal documents — migration 0105.

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('every document is seeded as a draft that cannot be published as is', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(read('../migrations/0105_legal_documents.sql'));
  const rows = db.prepare('SELECT slug, status, version, body_ar, published_body_ar FROM legal_documents ORDER BY slug').all();
  assert.deepEqual(rows.map((r) => r.slug).sort(), [...LEGAL_SLUGS].sort());
  for (const row of rows) {
    assert.equal(row.status, 'draft', row.slug);
    assert.equal(row.version, 0);
    assert.equal(row.published_body_ar, null, 'nothing public before the owner publishes');
    assert.ok(placeholdersIn(row.body_ar).length > 0, `${row.slug} leaves the legal specifics to the owner`);
  }
  assert.throws(() => db.exec("INSERT INTO legal_documents (slug, title_ar, body_ar) VALUES ('cookies', 't', 'b')"));
});

test('placeholders and slugs', () => {
  assert.deepEqual(placeholdersIn('راسلنا على {{بريد_الخصوصية}} أو {{بريد_الخصوصية}} و{{x}}'), ['{{بريد_الخصوصية}}', '{{x}}']);
  assert.deepEqual(placeholdersIn('بدون خانات'), []);
  assert.equal(isLegalSlug('privacy'), true);
  assert.equal(isLegalSlug('../privacy'), false);
});

test('the public route serves published copies only, and edits need publish', () => {
  const publicRoute = read('../src/routes/legal.ts');
  assert.equal((publicRoute.match(/status = 'published' AND published_body_ar IS NOT NULL/g) ?? []).length, 2);
  assert.doesNotMatch(publicRoute, /[\s,]body_ar AS body|SELECT \* /, 'the draft body is never selected publicly');
  assert.doesNotMatch(publicRoute, /\.(post|put|patch|delete)\(/);
  const admin = read('../src/routes/adminLegal.ts');
  for (const path of ["'/:slug'", "'/:slug/publish'", "'/:slug/unpublish'"]) {
    assert.ok(admin.split('\n').some((line) => line.includes(`${path}, requirePermission('publish')`)), path);
  }
  assert.match(admin, /code: 'placeholders'/);
});
