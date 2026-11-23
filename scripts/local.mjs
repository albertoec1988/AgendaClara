import http from 'node:http';
import {readFileSync,writeFileSync,renameSync,mkdirSync,existsSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validate,blankPlan} from '../web/model.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const privateDir=process.env.AGENDA_DATA_DIR||join(root,'.local');
mkdirSync(privateDir,{recursive:true});
const file=join(privateDir,'plan.json');
if(!existsSync(file))writeFileSync(file,JSON.stringify(blankPlan()),{flag:'wx'});
const initial=validate(JSON.parse(readFileSync(file,'utf8')));
const digest=s=>createHash('sha256').update(s).digest('hex');
let saved=JSON.stringify(initial),revision=digest(saved);
const port=Number(process.env.PORT??4178),host='127.0.0.1';
const assets=new Map([['/','index.html'],...['index.html','styles.css','app.js','model.js','brand.svg'].map(f=>['/'+f,f])]);
const types={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',svg:'image/svg+xml'};
const server=http.createServer(async(req,res)=>{
  const reply=(code,value)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  const authority=req.headers.host;
  if(![host+':'+port,'localhost:'+port].includes(authority))return reply(403,{error:'Host local requerido.'});
  const pathname=new URL(req.url,'http://'+authority).pathname;
  try{
    if(pathname==='/api/local-plan'){
      if(req.method==='GET')return reply(200,{revision,plan:JSON.parse(saved)});
      if(req.method!=='PUT')return reply(405,{error:'Método inválido.'});
      if(req.headers.origin!=='http://'+authority||!req.headers['content-type']?.startsWith('application/json'))return reply(403,{error:'Origen inválido.'});
      let chunks=[],size=0;for await(const c of req){size+=c.length;if(size>2_000_000)return reply(413,{error:'Respaldo demasiado grande.'});chunks.push(c);}
      let plan;try {plan=validate(JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch(e){return reply(400,{error:e.message});}
      if(req.headers['if-match']!==revision)return reply(409,{error:'Otra ventana modificó el plan. Descarga tus cambios y recarga la vista.'});
      const payload=JSON.stringify(plan),temp=join(privateDir,randomUUID()+'.tmp');
      writeFileSync(temp,payload,{flag:'wx',mode:0o600});renameSync(temp,file);saved=payload;revision=digest(payload);return reply(200,{revision});
    }
    if(req.method!=='GET'||!assets.has(pathname))return reply(404,{error:'No encontrado.'});
    const name=assets.get(pathname);
    res.writeHead(200,{'Content-Type':types[name.split('.').at(-1)],'Cache-Control':'no-store'});res.end(readFileSync(join(root,'web',name)));
  }catch{if(!res.headersSent)reply(500,{error:'No se pudo acceder al archivo local.'});else res.end();}
});
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'El puerto ya está ocupado. Comprueba si la agenda ya está abierta.':e.message);process.exitCode=1;});
server.listen(port,host,()=>console.log('ClearDebt Agenda en http://'+host+':'+port));
