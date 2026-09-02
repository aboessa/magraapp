import crypto from 'node:crypto';
function base64Url(bytes) {
  return Buffer.from(bytes).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'');
}
function createSignedToken(payload, secret) {
  const encodedPayload = base64Url(Buffer.from(JSON.stringify(payload)));
  const sig = crypto.createHmac('sha256', secret).update(encodedPayload).digest();
  return `${encodedPayload}.${base64Url(sig)}`;
}
const secretProd = 'txCOT69PZmdkDNnpByz6tTDgrlsDgBjTkwfbACFMWX9NiGZfy7Aja2PtwKYmIKMu';
const parentIdDemoFamily = '424b891b-090b-453a-aa63-f3ef865a5a42';
const emailDemoFamily = 'demo.family@majarra.app';
const exp = Math.floor(Date.now()/1000)+3600;
console.log('token for demo.family@majarra.app prod:', createSignedToken({typ:'email_verification', sub: parentIdDemoFamily, email: emailDemoFamily, exp}, secretProd));
console.log('token for demo.family2@majarra.app prod already verified, skipping');
