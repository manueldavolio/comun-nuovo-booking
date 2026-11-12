const encoder = new TextEncoder();
async function key() {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) throw new Error('Admin non configurato');
  return crypto.subtle.importKey('raw', encoder.encode(secret), {name:'HMAC',hash:'SHA-256'}, false, ['sign','verify']);
}
export async function createAdminSession() {
  const expires = String(Math.floor(Date.now()/1000)+86400);
  const signature = await crypto.subtle.sign('HMAC', await key(), encoder.encode('cn-admin-v1:'+expires));
  return expires+'.'+Array.from(new Uint8Array(signature), b=>b.toString(16).padStart(2,'0')).join('');
}
export async function validAdminSession(token:string|undefined) {
  if (!token || !/^\d{10}\.[a-f0-9]{64}$/.test(token)) return false;
  const [expires,signature]=token.split('.');
  const now=Math.floor(Date.now()/1000);
  if (Number(expires)<=now || Number(expires)>now+86400) return false;
  try { return await crypto.subtle.verify('HMAC',await key(),Uint8Array.from(signature.match(/../g)!, b=>parseInt(b,16)),encoder.encode('cn-admin-v1:'+expires)); }
  catch { return false; }
}
