// Serveur de scan d'exemple (Node 18+) : ANTHROPIC_API_KEY=... ORIGIN=https://ton-site node backend-example.js
import http from 'http';
const H=()=>({'Access-Control-Allow-Origin':process.env.ORIGIN||'*','Access-Control-Allow-Headers':'Content-Type','Content-Type':'application/json'});
http.createServer(async(q,s)=>{const h=H();if(q.method==='OPTIONS'){s.writeHead(204,h);return s.end()}
let b='';for await(const c of q){b+=c;if(b.length>3e6){s.writeHead(413,h);return s.end('{}')}}
try{const{image,consent}=JSON.parse(b);if(!consent||!/^data:image\/jpeg;base64,/.test(image))throw 0;
const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'x-api-key':process.env.ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01','content-type':'application/json'},body:JSON.stringify({model:'claude-sonnet-5-5',max_tokens:800,messages:[{role:'user',content:[{type:'image',source:{type:'base64',media_type:'image/jpeg',data:image.split(',')[1]}},{type:'text',text:'Identifie les aliments visibles. Réponds uniquement en JSON : {"items":[{"name":"","g":0,"p":0,"c":0,"f":0,"k":0}]} avec portions et valeurs ESTIMÉES (g, protéines, glucides, lipides, kcal). Si pas de nourriture : {"items":[]}'}]}]})});
const j=await r.json(),o=JSON.parse(j.content.map(x=>x.text||'').join('').replace(/```json|```/g,''));s.writeHead(200,h);s.end(JSON.stringify({items:o.items}))}catch(e){s.writeHead(502,h);s.end('{"error":"unavailable"}')}}).listen(process.env.PORT||8787);
