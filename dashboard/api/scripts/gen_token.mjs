import crypto from 'node:crypto';

function base64Url(bytes) {
  return Buffer.from(bytes).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'');
}

async function createSignedToken(payload, secret) {
  const encodedPayload = base64Url(Buffer.from(JSON.stringify(payload)));
  const sig = crypto.createHmac('sha256', secret).update(encodedPayload).digest();
  return `${encodedPayload}.${base64Url(sig)}`;
}

const secret = 'txCOT69PZmdkDNnpByz6tTDgrlsDgBjTkwfbACFMWX9NiGZfy7Aja2PtwKYmIKMu';
const parentId = '4a13b708-f9db-4cab-8572-f65adf008a9f';
const email = 'demo.family2@majarra.app';
const exp = Math.floor(Date.now()/1000)+3600;
const token = await createSignedToken({typ:'email_verification', sub: parentId, email, exp}, secret);
console.log(token);
