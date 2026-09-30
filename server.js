// QR Event Platform server: zero dependencies, JSON-file storage.
// Env: PORT (3000), ADMIN_PASSWORD (required in production), DATA_FILE (path to data.json)
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const PORT=process.env.PORT||3000,PASS=process.env.ADMIN_PASSWORD||'admin',FILE=process.env.DATA_FILE||path.join(__dirname,'data.json');
if(PASS==='admin')console.warn('WARNING: using default admin password. Set ADMIN_PASSWORD.');
let D;try{D=JSON.parse(fs.readFileSync(FILE,'utf8'))}catch(e){D={ev:[],R:[]}}
const save=()=>{fs.writeFileSync(FILE+'.tmp',JSON.stringify(D));fs.renameSync(FILE+'.tmp',FILE)};
const TOKEN=crypto.createHmac('sha256',PASS).update('qrevents-admin').digest('hex');
const eq=(a,b)=>a.length===b.length&&crypto.timingSafeEqual(Buffer.from(a),Buffer.from(b));
const send=(res,c,o)=>{res.writeHead(c,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(o))};
function api(req,res,u,p,m,b){
  const adm=eq(String(req.headers['x-token']||''),TOKEN),s=p.slice(5).split('/');
  const ok=o=>send(res,200,o),no=c=>send(res,c||403,{error:'denied'});
  if(s[0]==='state'){
    if(adm)return ok({admin:true,ev:D.ev,R:D.R});
    const me=(u.searchParams.get('me')||'').split(',');
    return ok({admin:false,ev:D.ev.map(({v,...e})=>e),R:D.R.filter(r=>me.includes(r.id))});}
  if(s[0]==='login'&&m==='POST')return String(b.password||'')===PASS?ok({token:TOKEN}):setTimeout(()=>no(401),600);
  if(s[0]==='view'&&m==='POST'){const e=D.ev.find(x=>x.id===s[1]);if(e){e.v=(e.v||0)+1;save()}return ok({})}
  if(s[0]==='respond'&&m==='POST'){
    if(!D.ev.some(x=>x.id===b.e)||!['y','n'].includes(b.t))return no(400);
    const r={id:crypto.randomBytes(8).toString('hex'),e:b.e,t:b.t,s:b.t==='y'?'interested':'',ts:Date.now()};D.R.push(r);save();return ok(r);}
  if(s[0]==='response'){
    const r=D.R.find(x=>x.id===s[1]);if(!r)return no(404);
    if(m==='DELETE'){D.R=D.R.filter(x=>x!==r);save();return ok({})}
    if(m==='POST'){
      if(b.s==='registered'&&r.s==='interested')r.s='registered';
      if(b.done&&r.t==='n'){r.r=String(b.r||'Other').slice(0,80);r.c=String(b.c||'').slice(0,1000);r.done=1}
      save();return ok(r);}}
  if(!adm)return no();
  if(s[0]==='status'&&m==='POST'){const r=D.R.find(x=>x.id===s[1]);if(r&&['interested','registered','attended'].includes(b.s)){r.s=b.s;save()}return ok({})}
  if(s[0]==='events'&&m==='POST'){
    const o={};for(const k of ['name','desc','date','st','et','loc'])o[k]=String(b[k]||'').slice(0,2000);
    if(b.id){const e=D.ev.find(x=>x.id===b.id);if(!e)return no(404);Object.assign(e,o);if(typeof b.img==='string')e.img=b.img;if('arch' in b)e.arch=!!b.arch}
    else D.ev.push({id:crypto.randomBytes(4).toString('hex'),...o,img:typeof b.img==='string'?b.img:'',v:0,arch:false});
    save();return ok({});}
  if(s[0]==='events'&&m==='DELETE'){D.ev=D.ev.filter(x=>x.id!==s[1]);D.R=D.R.filter(x=>x.e!==s[1]);save();return ok({})}
  no(404);}
http.createServer((req,res)=>{
  const u=new URL(req.url,'http://x'),p=u.pathname,m=req.method;
  if(!p.startsWith('/api/')){
    if(p!=='/'&&p!=='/index.html'){res.writeHead(404);return res.end('Not found')}
    res.writeHead(200,{'content-type':'text/html; charset=utf-8'});return fs.createReadStream(path.join(__dirname,'index.html')).pipe(res);}
  let b='';req.on('data',c=>{b+=c;if(b.length>3e6)req.destroy()});
  req.on('end',()=>{try{api(req,res,u,p,m,b?JSON.parse(b):{})}catch(e){send(res,400,{error:'bad request'})}});
}).listen(PORT,()=>console.log('QR Event Platform running on http://localhost:'+PORT));
