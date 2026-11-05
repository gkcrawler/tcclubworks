const {createHmac, createHash, timingSafeEqual, randomBytes} = require('node:crypto');
const COOKIE = '__Host-ccw_shop';
function password() { return process.env.QUOTE_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || ''; }
function equal(a,b) { return timingSafeEqual(createHash('sha256').update(String(a)).digest(),createHash('sha256').update(String(b)).digest()); }
function key() { return process.env.SHOP_SESSION_SECRET || createHmac('sha256',password()).update('CCW shop session v1').digest('hex'); }
function sign(v) { return createHmac('sha256',key()).update(v).digest('base64url'); }
function issueSession(remember=false, now=Date.now()) {
 const age=remember?30*86400:12*3600;
 const payload=Buffer.from(JSON.stringify({exp:Math.floor(now/1000)+age,nonce:randomBytes(18).toString('base64url')})).toString('base64url');
 return `${COOKIE}=${payload}.${sign(payload)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
}
function validSession(cookie='', now=Date.now()) {
 if(!password())return false;
 const raw=cookie.split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
 if(!raw || raw.length>1024)return false;
 const [payload,signature,...extra]=raw.split('.');
 if(!signature||extra.length||!equal(signature,sign(payload)))return false;
 try {const value=JSON.parse(Buffer.from(payload,'base64url')); return Number.isInteger(value.exp)&&value.exp>now/1000&&typeof value.nonce==='string';}catch{return false;}
}
function validPassword(supplied){return !!password()&&typeof supplied==='string'&&supplied.length<=1024&&equal(supplied,password());}
function validBasic(header='') {
 if(!/^Basic /i.test(header))return false;
 const decoded=Buffer.from(header.slice(6),'base64').toString('utf8');
 return validPassword(decoded.includes(':')?decoded.slice(decoded.indexOf(':')+1):decoded);
}
function authorizedLegacy(event){
 const h=event.headers||{};
 if(validBasic(h.authorization||''))return true;
 if(!validSession(h.cookie||''))return false;
 return event.httpMethod==='GET'||h.origin===`https://${h.host}`;
}
function clearSession(){return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;}
module.exports={COOKIE,validSession,validPassword,validBasic,authorizedLegacy,issueSession,clearSession,password};
