// Serveur push d'exemple (Node 18+). npm i web-push ; npx web-push generate-vapid-keys
// VAPID_SUBJECT=mailto:toi@exemple.com VAPID_PUBLIC=... VAPID_PRIVATE=... ORIGIN=https://ton-site node backend-push-example.js
import http from 'http';import fs from 'fs';import webpush from 'web-push';
webpush.setVapidDetails(process.env.VAPID_SUBJECT,process.env.VAPID_PUBLIC,process.env.VAPID_PRIVATE);
const F='subs.json';let S=fs.existsSync(F)?JSON.parse(fs.readFileSync(F)):{};const W=()=>fs.writeFileSync(F,JSON.stringify(S));
const H={'Access-Control-Allow-Origin':process.env.ORIGIN||'*','Access-Control-Allow-Headers':'Content-Type','Content-Type':'application/json'};
http.createServer(async(q,s)=>{if(q.method==='OPTIONS'){s.writeHead(204,H);return s.end()}
let b='';for await(const c of q){b+=c;if(b.length>2e5){s.writeHead(413,H);return s.end('{}')}}
try{const j=JSON.parse(b);
if(q.url.endsWith('/subscribe')){if(!j.sub||!j.sub.endpoint)throw 0;S[j.sub.endpoint]={sub:j.sub,tz:String(j.tz),rm:(j.reminders||[]).slice(0,10).map(r=>({k:String(r.k),t:String(r.t),on:!!r.on,m:String(r.m).slice(0,140)}))};W()}
else if(q.url.endsWith('/unsubscribe')){delete S[j.endpoint];W()}else throw 0;
s.writeHead(200,H);s.end('{"ok":true}')}catch(e){s.writeHead(400,H);s.end('{"error":"bad request"}')}}).listen(process.env.PORT||8788);
setInterval(()=>{const n=new Date();for(const[ep,x]of Object.entries(S)){let hm;try{hm=new Intl.DateTimeFormat('fr-FR',{timeZone:x.tz,hour:'2-digit',minute:'2-digit',hour12:false}).format(n)}catch{continue}
for(const r of x.rm)if(r.on&&r.t===hm)webpush.sendNotification(x.sub,JSON.stringify({title:'PROJECT VERTICAL',body:r.m,tag:r.k})).catch(e=>{if(e.statusCode===404||e.statusCode===410){delete S[ep];W()}})}},60000);
