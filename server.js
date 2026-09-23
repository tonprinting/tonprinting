const http=require('http');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const {URL}=require('url');

const PORT=Number(process.env.PORT||3000);
const RAW_SUPABASE=(process.env.SUPABASE_URL||'').trim().replace(/\/$/,'');
const KEY=(process.env.SUPABASE_SERVICE_ROLE_KEY||'').trim();
let SUPABASE_URL='';
try { if(RAW_SUPABASE) SUPABASE_URL=new URL(RAW_SUPABASE).toString().replace(/\/$/,''); } catch(e) { console.warn('Invalid SUPABASE_URL; using local storage.'); }
const USE_SUPABASE=!!(SUPABASE_URL && KEY);
const USER=process.env.ADMIN_USERNAME||'admin';
const PASSWORD=process.env.ADMIN_PASSWORD||'ChangeMe123!';
const DATA_FILE=path.join(__dirname,'data','store.json');
const sessions=new Set();
const DEFAULT={settings:{id:1,shop_name:'SBUYPRINT',tagline:'งานพิมพ์และสินค้าสำหรับร้านของคุณ',footer:'',logo:'',qr_code:'',phone:'',line:'',facebook:'',email:'',address:''},products:[]};

function clone(x){return JSON.parse(JSON.stringify(x));}
function loadLocal(){try{if(!fs.existsSync(DATA_FILE)){fs.mkdirSync(path.dirname(DATA_FILE),{recursive:true});fs.writeFileSync(DATA_FILE,JSON.stringify(DEFAULT,null,2));}let d=JSON.parse(fs.readFileSync(DATA_FILE,'utf8'));return {settings:{...DEFAULT.settings,...(d.settings||{})},products:Array.isArray(d.products)?d.products:[]};}catch(e){console.error(e);return clone(DEFAULT);}}
function saveLocal(d){fs.mkdirSync(path.dirname(DATA_FILE),{recursive:true});fs.writeFileSync(DATA_FILE,JSON.stringify(d,null,2));}
function send(res,s,t,b,h={}){res.writeHead(s,{'Content-Type':t,'Cache-Control':'no-store',...h});res.end(b)}
function json(res,s,o,h={}){send(res,s,'application/json; charset=utf-8',JSON.stringify(o),h)}
function cookies(req){return Object.fromEntries((req.headers.cookie||'').split(';').filter(Boolean).map(x=>{let i=x.indexOf('=');return[x.slice(0,i).trim(),decodeURIComponent(x.slice(i+1).trim())]}))}
function auth(req){const sid=cookies(req).sid;return !!(sid&&sessions.has(sid));}
function body(req){return new Promise((ok,no)=>{let b='';req.on('data',c=>{b+=c;if(b.length>50e6)no(Error('ข้อมูลใหญ่เกินไป'))});req.on('end',()=>{try{ok(b?JSON.parse(b):{})}catch(e){no(e)}});req.on('error',no)})}
async function sb(p,o={}){if(!USE_SUPABASE)throw Error('Supabase ยังไม่ได้ตั้งค่า');const target=new URL(p,SUPABASE_URL+'/').toString();const r=await fetch(target,{...o,headers:{apikey:KEY,Authorization:`Bearer ${KEY}`,'Content-Type':'application/json',...(o.headers||{})}});const t=await r.text();let d;try{d=t?JSON.parse(t):null}catch{d=t}if(!r.ok)throw Error(`Supabase ${r.status}: ${typeof d==='string'?d:JSON.stringify(d)}`);return d;}
async function catalog(){
 if(!USE_SUPABASE)return loadLocal();
 try{let [s,p]=await Promise.all([sb('/rest/v1/settings?id=eq.1&select=*'),sb('/rest/v1/products?select=*&order=id.asc')]);return {settings:s[0]||DEFAULT.settings,products:p||[]};}
 catch(e){console.error(e);return {...loadLocal(),dbError:e.message};}
}
async function upload(data){
 let m=String(data||'').match(/^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,(.+)$/);
 if(!m)return data||'';
 if(!USE_SUPABASE)return data;
 const ext=m[1].split('/')[1].replace('jpeg','jpg'),fn=`${Date.now()}-${crypto.randomBytes(5).toString('hex')}.${ext}`,buf=Buffer.from(m[2],'base64');
 const r=await fetch(`${SUPABASE_URL}/storage/v1/object/product-images/${fn}`,{method:'POST',headers:{apikey:KEY,Authorization:`Bearer ${KEY}`,'Content-Type':m[1],'x-upsert':'true'},body:buf});
 if(!r.ok)throw Error('อัปโหลดรูปไม่สำเร็จ: '+await r.text());
 return `${SUPABASE_URL}/storage/v1/object/public/product-images/${fn}`;
}
async function main(req,res){
 const u=new URL(req.url,`http://${req.headers.host||'localhost'}`),p=u.pathname;
 if(req.method==='GET'&&p==='/health')return json(res,200,{ok:true,service:'sbuyprint',storage:USE_SUPABASE?'supabase':'local'});
 if(req.method==='GET'&&(p==='/'||p==='/shop'))return send(res,200,'text/html; charset=utf-8',fs.readFileSync(path.join(__dirname,'public/index.html'),'utf8'));
 if(req.method==='GET'&&p==='/admin')return send(res,200,'text/html; charset=utf-8',fs.readFileSync(path.join(__dirname,'public/admin.html'),'utf8'));
 if(req.method==='GET'&&p==='/api/catalog')return json(res,200,await catalog());
 if(req.method==='GET'&&p==='/api/me')return json(res,200,{loggedIn:auth(req)});
 if(req.method==='POST'&&p==='/api/login'){let b=await body(req);if(b.username===USER&&b.password===PASSWORD){let sid=crypto.randomBytes(32).toString('hex');sessions.add(sid);return json(res,200,{ok:true},{'Set-Cookie':`sid=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400`})}return json(res,401,{error:'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'});}
 if(req.method==='POST'&&p==='/api/logout'){sessions.delete(cookies(req).sid);return json(res,200,{ok:true},{'Set-Cookie':'sid=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax'});}
 if(p.startsWith('/api/')&&!auth(req))return json(res,401,{error:'กรุณาเข้าสู่ระบบ'});
 if(req.method==='POST'&&p==='/api/products'){
   let b=await body(req);if(!b.category||!b.name)return json(res,400,{error:'กรุณากรอกหมวดหมู่และชื่อสินค้า'});let image=await upload(b.image);
   if(!USE_SUPABASE){let d=loadLocal(),id=d.products.reduce((m,x)=>Math.max(m,Number(x.id)||0),0)+1;let product={id,category:b.category,name:b.name,price:String(b.price||''),description:b.description||'',image};d.products.push(product);saveLocal(d);return json(res,200,{ok:true,product});}
   let rows=await sb('/rest/v1/products',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({category:b.category,name:b.name,price:String(b.price||''),description:b.description||'',image})});return json(res,200,{ok:true,product:rows[0]});
 }
 if(req.method==='PUT'&&/^\/api\/products\/\d+$/.test(p)){
   let id=Number(p.split('/').pop()),b=await body(req),image=b.image;if(String(image||'').startsWith('data:'))image=await upload(image);
   if(!USE_SUPABASE){let d=loadLocal(),i=d.products.findIndex(x=>Number(x.id)===id);if(i<0)return json(res,404,{error:'ไม่พบสินค้า'});d.products[i]={...d.products[i],category:b.category,name:b.name,price:String(b.price||''),description:b.description||'',image:image||d.products[i].image||''};saveLocal(d);return json(res,200,{ok:true,product:d.products[i]});}
   let rows=await sb(`/rest/v1/products?id=eq.${id}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({category:b.category,name:b.name,price:String(b.price||''),description:b.description||'',image:image||''})});return json(res,200,{ok:true,product:rows[0]});
 }
 if(req.method==='DELETE'&&/^\/api\/products\/\d+$/.test(p)){
   let id=Number(p.split('/').pop());
   if(!USE_SUPABASE){let d=loadLocal();d.products=d.products.filter(x=>Number(x.id)!==id);saveLocal(d);return json(res,200,{ok:true});}
   await sb(`/rest/v1/products?id=eq.${id}`,{method:'DELETE'});return json(res,200,{ok:true});
 }
 if(req.method==='PUT'&&p==='/api/settings'){
   let b=await body(req),logo=b.logo;if(String(logo||'').startsWith('data:'))logo=await upload(logo);let qr_code=b.qr_code;if(String(qr_code||'').startsWith('data:'))qr_code=await upload(qr_code);let payload={shop_name:b.shop_name||'SBUYPRINT',tagline:b.tagline||'',footer:b.footer||'',logo:logo||'',qr_code:qr_code||'',phone:b.phone||'',line:b.line||'',facebook:b.facebook||'',email:b.email||'',address:b.address||''};
   if(!USE_SUPABASE){let d=loadLocal();d.settings={...d.settings,...payload,id:1};saveLocal(d);return json(res,200,{ok:true,settings:d.settings});}
   let rows=await sb('/rest/v1/settings?id=eq.1',{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(payload)});return json(res,200,{ok:true,settings:rows[0]});
 }
 return send(res,404,'text/plain; charset=utf-8','Not found');
}
http.createServer((q,r)=>main(q,r).catch(e=>{console.error(e);json(r,500,{error:e.message})})).listen(PORT,'0.0.0.0',()=>console.log(`SBUYPRINT listening on http://localhost:${PORT} | storage=${USE_SUPABASE?'supabase':'local'}`));
