import { webcrypto } from 'node:crypto';
function base64Url(b){ return Buffer.from(b).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'') }
async function hashPassword(p){
  const salt = webcrypto.getRandomValues(new Uint8Array(16));
  const key = await webcrypto.subtle.importKey('raw', new TextEncoder().encode(p), 'PBKDF2', false, ['deriveBits']);
  const derived = await webcrypto.subtle.deriveBits({name:'PBKDF2', salt, iterations:100000, hash:'SHA-256'}, key, 256);
  return `pbkdf2-sha256$100000$${base64Url(salt)}$${base64Url(new Uint8Array(derived))}`;
}
console.log(await hashPassword('AdminDemo123!@#'));
