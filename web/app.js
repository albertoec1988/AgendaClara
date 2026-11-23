import {validate,compute,blankPlan,fields,addDays,monday,monthOf,dates,weekday} from './model.js';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const usd=(v,digits=2)=>v==null?'Pendiente':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:digits,maximumFractionDigits:digits}).format(v/100);
const dateText=(d,opts)=>d?new Intl.DateTimeFormat('es-US',{timeZone:'UTC',...opts}).format(new Date(d+'T12:00:00Z')):'Pendiente';
const short=d=>dateText(d,{day:'numeric',month:'short'});
const long=d=>dateText(d,{weekday:'long',day:'numeric',month:'long'});
const cap=t=>t.charAt(0).toUpperCase()+t.slice(1);
const monthText=m=>cap(dateText(m+'-01',{month:'long',year:'numeric'}));
const currency=v=>usd(v,v%100===0?0:2);
const nav=[['week','Mi semana','calendar'],['sends','Envíos por tarjeta','send'],['monthly','Plan mensual','bars'],['fridays','Cada viernes','wallet'],['cash','Caja diaria','trend'],['budget','Presupuesto','sliders'],['bills','Gastos fijos','receipt'],['cards','Tarjetas','card'],['dues','Vencimientos','clock']];
const descriptions={sends:'Importes pendientes, fechas de envío y prioridad del mes.',monthly:'Distribución del dinero entre renta, servicios, comida y deuda.',fridays:'Los sobres que puedes apartar con cada cobro.',cash:'Entradas, salidas y efectivo proyectado al cierre de cada día.',budget:'Los importes de referencia de tu planificación.',bills:'Facturas por mes y día habitual de pago.',cards:'Saldos, tasas de compras y mínimos de tus tarjetas.',dues:'Estados de cuenta, vencimientos y pagos acreditados.'};
const paths={calendar:'M4 7h16v13H4z M4 10h16 M8 4v5 M16 4v5',send:'m3 10 18-7-6 18-4-8-8-3z M11 13l10-10',bars:'M4 20h16 M6 17v-5 M12 17V5 M18 17V9',wallet:'M4 7h15v12H4z M4 7l12-4v4 M15 11h5v4h-5z',trend:'M3 18l6-7 4 3 8-9 M16 5h5v5',sliders:'M4 7h7m5 0h4 M4 17h2m5 0h9 M11 4h4v6h-4z M6 14h4v6H6z',receipt:'M6 3h12v18l-3-2-3 2-3-2-3 2z M9 8h6 M9 12h6',card:'M3 5h18v14H3z M3 10h18 M6 15h4',clock:'M12 3a9 9 0 1 0 .1 0 M12 7v5l4 2',folder:'M3 6h6l2 2h10v11H3z',up:'m6 16 12-12 M9 4h9v9',down:'M18 6 6 18 M6 9v9h9',bag:'M5 9h14l1 12H4z M9 9V7a3 3 0 0 1 6 0v2',home:'m3 11 9-8 9 8 M6 9v12h12V9',check:'m4 12 5 5L20 6',chev:'m9 5 7 7-7 7',left:'m15 5-7 7 7 7',edit:'m4 16-1 5 5-1L20 8l-4-4z M13 7l4 4',cloud:'M7 18h10a4 4 0 0 0 0-8 6 6 0 0 0-11-2 5 5 0 0 0 1 10',shield:'m12 3 8 3v6c0 5-4 8-8 10-4-2-8-5-8-10V6z M8 12l3 3 5-6',plus:'M12 4v16 M4 12h16',coins:'M4 6h15v12H4z M7 10h3 M13 14h3',dot:'M6 12h12'};
const icon=(n,size=19)=>'<svg aria-hidden="true" width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path d="'+(paths[n]??paths.dot)+'"/></svg>';
let plan,model,local=false,revision='',view='week',selected,week,month,dirty=false,saving=false,conflict=false,failed=false;
const storageKey='cleardebt.agenda.v1',prefKey='cleardebt.agenda.view';
let draftVersion=0,noticeTimer;
const dialog=$('editor');
function notice(t){$('notice').textContent=t;$('notice').classList.add('visible');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('notice').classList.remove('visible'),4500);}
function savedStatus(){
  const text=conflict?'Conflicto de cambios':failed?'Error al guardar':dirty||saving?'Guardando…':local?'Guardado en este equipo':'Guardado en este navegador';
  $('save').innerHTML=icon(conflict||failed?'clock':'cloud',17)+' '+text;
  $('save').classList.toggle('bad',conflict||failed);
}
let scheduled;
async function flush(){
  if(saving||!dirty||conflict)return;
  const snapshot=JSON.stringify(plan),seq=draftVersion;saving=true;failed=false;savedStatus();
  try{
    if(local){
      const res=await fetch('/api/local-plan',{method:'PUT',headers:{'Content-Type':'application/json','If-Match':revision},body:snapshot});
      const data=await res.json();if(!res.ok){if(res.status===409)conflict=true;throw Error(data.error||'No se pudo guardar.');}
      revision=data.revision;
    }else{
      if((localStorage.getItem(storageKey)??'')!==revision){conflict=true;throw Error('Otra pestaña cambió el plan. Descarga tu copia antes de recargar.');}
      localStorage.setItem(storageKey,snapshot);revision=snapshot;
    }
    if(draftVersion===seq)dirty=false;
  }catch(e){failed=true;notice(e.message);}
  finally{saving=false;savedStatus();if(dirty&&!failed&&!conflict)void flush();}
}
function changed(){model=compute(plan);dirty=true;draftVersion++;clearTimeout(scheduled);scheduled=setTimeout(flush,120);draw();savedStatus();}
window.addEventListener('beforeunload',e=>{if(dirty||saving){void flush();e.preventDefault();e.returnValue='';}});
window.addEventListener('storage',e=>{if(!local&&e.key===storageKey&&e.newValue&&plan){if(dirty||dialog.open){conflict=true;savedStatus();notice('Hay cambios en otra ventana. Descarga tu copia y recarga.');}else{try{plan=validate(JSON.parse(e.newValue));revision=e.newValue;model=compute(plan);setSelections();draw();}catch{notice('El respaldo de la otra ventana no es válido.');}}}});
function setSelections(){
  let prefs={};try{prefs=JSON.parse(localStorage.getItem(prefKey)||'{}');}catch{}
  const defaultMonth=model.months[1]?.key??monthOf(plan.start);
  week=prefs.week??monday(defaultMonth+'-01');if(week<monday(plan.start)||week>monday(plan.end))week=monday(plan.start);
  selected=prefs.selected??addDays(week,4);if(selected<week||selected>addDays(week,6)||!model.byDate.has(selected))selected=model.days.find(d=>d.date>=week)?.date??plan.start;
  month=model.months.some(m=>m.key===prefs.month)?prefs.month:defaultMonth;
  const key=location.hash.slice(1);view=nav.some(x=>x[0]===key)?key:'week';
}
function remember(){try{localStorage.setItem(prefKey,JSON.stringify({week,selected,month}));}catch{}}
async function start(){
  try{
    const response=await fetch('/api/local-plan',{cache:'no-store'});
    if(response.ok&&response.headers.get('content-type')?.includes('application/json')){
      const obj=await response.json();plan=validate(obj.plan);local=true;revision=obj.revision;
    }else if(response.status===404||response.status===200&&!response.headers.get('content-type')?.includes('application/json')){
      revision=localStorage.getItem(storageKey)??'';plan=revision?validate(JSON.parse(revision)):blankPlan();
    }else throw Error('No se pudo leer el plan. Recarga la página para volver a intentar.');
    model=compute(plan);setSelections();draw();savedStatus();
  }catch(e){$('main').innerHTML='<h1>Plan no disponible</h1><p>'+esc(e.message)+'</p><button onclick="location.reload()">Volver a intentar</button>';}
}
function sidebar(){const links=(a)=>a.map(([id,label,ic])=>'<a class="navlink '+(view===id?'on':'')+'" href="#'+id+'" '+(view===id?'aria-current="page"':'')+'>'+icon(ic)+'<span>'+label+'</span></a>').join('');
  $('rail').innerHTML='<div class="brand"><img src="./brand.svg" alt=""><span>ClearDebt</span></div><nav><div class="navgroup">Planificación</div>'+links(nav.slice(0,5))+'<div class="navgroup">Mis finanzas</div>'+links(nav.slice(5))+'</nav><div class="railend"><button data-action="backup">'+icon('folder')+' Datos y respaldo</button><div class="localtag"><i></i>'+ (local?'Espacio local':'Espacio del navegador')+'</div></div>';
}
function monthSelect(){return '<label class="monthsel">'+icon('calendar')+'<select aria-label="Mes de la vista" data-action="month">'+model.months.map(m=>'<option value="'+m.key+'" '+(m.key===month?'selected':'')+'>'+monthText(m.key)+'</option>').join('')+'</select></label>';}
function title(name,sub,control=''){return '<div class="pagehead"><div><h1>'+esc(name)+'</h1><p>'+esc(sub)+'</p></div>'+control+'</div>';}
function kpi(label,value,sub,ic,kind=''){return '<article class="kpi '+kind+'"><div class="klabel">'+icon(ic,17)+esc(label)+'</div><strong>'+esc(value)+'</strong><small>'+esc(sub)+'</small></article>';}
function desc(type){return {income:'Ingreso',bill:'Servicio',card:'Tarjeta',rent:'Vivienda',food:'Comida',undated:'Otros gastos',extra:'Pago adicional'}[type];}
const eventIcon={income:'down',rent:'home',bill:'receipt',card:'card',food:'bag',undated:'wallet',extra:'send'};
function weekPage(){
  const weekDates=dates(week,addDays(week,6)),ds=weekDates.map(d=>model.byDate.get(d)).filter(Boolean),rec=ds.reduce((n,d)=>n+d.income,0),out=ds.reduce((n,d)=>n+d.out,0);
  const active=model.byDate.get(selected)??ds[0],first=monday(plan.start),final=monday(plan.end);
  const lastDay=addDays(week,6),nCobros=ds.filter(d=>d.income).length; const wLabel=short(week)+(week.slice(0,4)!==lastDay.slice(0,4)?' '+week.slice(0,4):'')+' – '+short(lastDay)+' de '+lastDay.slice(0,4);
  const selector='<div class="weeknav"><button aria-label="Semana anterior" data-action="prev" '+(week<=first?'disabled':'')+'>'+icon('left',15)+'</button><label>'+icon('calendar',16)+'<select aria-label="Elegir semana" data-action="week">'+dates(first,final,7).map(d=>'<option value="'+d+'" '+(d===week?'selected':'')+'>'+short(d)+' – '+short(addDays(d,6))+'</option>').join('')+'</select></label><button aria-label="Semana siguiente" data-action="next" '+(week>=final?'disabled':'')+'>'+icon('chev',15)+'</button></div>';
  const days=weekDates.map((date,i)=>{const d=model.byDate.get(date);return '<button class="day '+(date===active.date?'picked':'')+'" data-day="'+date+'" aria-pressed="'+(date===active.date)+'" '+(!d?'disabled':'')+'><span>'+['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'][i]+'</span><b>'+Number(date.slice(8))+'</b><div class="daymarks">'+(d?.income?'<i class="in"></i>':'')+(d?.out?'<i class="out"></i>':'')+(!d?.out&&!d?.income?'<i></i>':'')+'</div></button>';}).join('');
  const ev=active.events;
  const events=ev.map((e,i)=>'<button class="movement" data-event="'+i+'"><span class="eventicon '+e.type+'">'+icon(eventIcon[e.type])+'</span><span class="ename"><b>'+esc(e.label)+'</b><small>'+esc(e.note??desc(e.type))+'</small></span><strong class="'+(e.type==='income'?'green':'')+'">'+(e.type==='income'?'+':'−')+usd(e.value)+'</strong>'+icon('chev',14)+'</button>').join('');
  return title('Mi semana',wLabel,selector)+'<div class="kpis">'+kpi('Caja al cierre',usd(ds.at(-1).cash),'Saldo previsto al '+short(ds.at(-1).date),'wallet','feature')+kpi('Ingresos previstos',usd(rec),nCobros+' '+(nCobros===1?'cobro':'cobros')+' esta semana','down','income')+kpi('Salidas previstas',usd(out),'Incluye facturas, comida y mínimos','up','spend')+'</div>'+
  '<section class="panel calendar"><div class="panelhead"><h2>Calendario semanal</h2><div class="legend"><span><i class="in"></i>Ingresos</span><span><i class="out"></i>Salidas</span></div></div><div class="days">'+days+'</div></section>'+
  '<div class="split"><section class="panel"><div class="panelhead"><div><p class="eyebrow">Agenda del día</p><h2>'+cap(long(active.date))+'</h2></div><span class="count">'+ev.length+'</span></div><div class="eventlist">'+(events||'<p class="empty">Sin pagos ni cobros programados para este día.</p>')+'</div><div class="paneltotal"><span>Caja al cierre del día</span><b>'+usd(active.cash)+'</b></div></section>'+
  '<section class="panel trend"><div class="panelhead"><div><p class="eyebrow">Efectivo disponible</p><h2>Caja durante la semana</h2></div>'+icon('trend')+'</div><canvas id="chart" aria-label="Evolución del efectivo diario en dólares"></canvas><div class="chartkey"><span><i></i>Caja prevista</span><span><i></i>Fondo mínimo</span></div><a href="#cash" data-cashcontext="1" class="textlink">Ver caja diaria '+icon('chev',14)+'</a></section></div>'+
  '<details class="panel scenario"><summary>Simular un ahorro semanal</summary><p>Compara el efectivo al final del plan, tras la renta del '+short(plan.end)+'.</p><div class="scenario-grid"><span>Ahorro por viernes <button data-action="savings">'+usd(plan.settings.saving)+' '+icon('edit',14)+'</button></span><span>Saldo base <b>'+usd(model.last.cash)+'</b></span><span>Con el ajuste <b>'+usd(model.last.scenario)+'</b></span></div></details>';
}
function plot(){
  const canvas=$('chart');if(!canvas)return;
  const W=canvas.clientWidth,H=170,pixel=devicePixelRatio||1;canvas.width=W*pixel;canvas.height=H*pixel;
  const ctx=canvas.getContext('2d');ctx.scale(pixel,pixel);const ds=dates(week,addDays(week,6)).map(d=>model.byDate.get(d));const amounts=[...ds.filter(Boolean).map(d=>d.cash),plan.settings.floor,0],lo=Math.min(...amounts),hi=Math.max(...amounts,lo+100);
  const L=48,R=W-12,T=13,B=143;const x=i=>L+(R-L)*i/6,y=v=>B-(v-lo)/(hi-lo)*(B-T);
  ctx.font='11px Arial';ctx.textAlign='right';ctx.fillStyle='#68766f';for(let n=0;n<=2;n++){const yt=T+(B-T)*n/2;ctx.strokeStyle='#e5e9e4';ctx.beginPath();ctx.moveTo(L,yt);ctx.lineTo(R,yt);ctx.stroke();ctx.fillText(currency(Math.round((hi-(hi-lo)*n/2)/100)*100),L-5,yt+3);}
  const points=ds.flatMap((d,i)=>d?[[x(i),y(d.cash),i]]:[]);if(!points.length)return;
  ctx.beginPath();ctx.moveTo(points[0][0],B);for(const [xx,yy] of points)ctx.lineTo(xx,yy);ctx.lineTo(points.at(-1)[0],B);ctx.closePath();const gr=ctx.createLinearGradient(0,T,0,B);gr.addColorStop(0,'#acceb3aa');gr.addColorStop(1,'#d3e9d644');ctx.fillStyle=gr;ctx.fill();
  ctx.setLineDash([4,4]);ctx.strokeStyle='#a58b61';ctx.beginPath();ctx.moveTo(L,y(plan.settings.floor));ctx.lineTo(R,y(plan.settings.floor));ctx.stroke();ctx.setLineDash([]);ctx.beginPath();points.forEach(([xx,yy],i)=>i?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy));ctx.lineWidth=2.5;ctx.strokeStyle='#2b735c';ctx.stroke();
  for(const [xx,yy,i] of points){ctx.beginPath();ctx.arc(xx,yy,ds[i].date===selected?4.5:2.7,0,2*Math.PI);ctx.fillStyle='#307357';ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=1.3;ctx.stroke();}
  ctx.fillStyle='#55635d';ctx.textAlign='center';['L','M','X','J','V','S','D'].forEach((v,i)=>ctx.fillText(v,x(i),162));
}
window.addEventListener('resize',plot);
function table(head,rows,empty='Sin registros para este período.'){return '<div class="tablewrap"><table><thead><tr>'+head.map(x=>'<th>'+esc(x)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(c=>'<tr>'+c.map((x,i)=>'<td data-label="'+esc(head[i])+'">'+x+'</td>').join('')+'</tr>').join('')+'</tbody></table>'+(rows.length?'':'<p class="empty">'+empty+'</p>')+'</div>';}
const editBtn=(kind,id='',m=month)=>'<button class="rowedit" aria-label="Editar registro" data-edit="'+kind+'" data-id="'+esc(id)+'" data-month="'+esc(m)+'">'+icon('edit',15)+' Editar</button>';
const panel=(heading,content,action='')=>'<section class="panel"><div class="panelhead"><h2>'+esc(heading)+'</h2>'+action+'</div>'+content+'</section>';
const tag=(s,style='')=>'<span class="tag '+style+'">'+esc(s)+'</span>';
function otherPage(){
  const n=nav.find(v=>v[0]===view),m=model.months.find(x=>x.key===month);
  let body='',control=['sends','fridays','dues','bills','cash'].includes(view)?monthSelect():'';
  if(view==='monthly'){
    body=panel('Distribución mensual',table(['Mes','Cobros','Renta siguiente','Servicios','Comida','Para deuda','Fondo al cierre'],model.months.map(m=>['<button class="link" data-gocash="'+m.key+'">'+monthText(m.key)+'</button>',usd(m.income),usd(m.rent),usd(m.bills),usd(m.food),usd(m.debt),usd(m.close)])))+'<p class="footnote">El fondo al cierre de esta vista excluye los sobres apartados. Caja diaria muestra el efectivo según las fechas de cobro y pago.</p>';
  }else if(view==='fridays'){
    body=panel('Sobres de cada cobro',table(['Viernes','Cobro','Renta','Servicios','Comida','Para deuda','Fondo al cierre',''],m.weeks.map(w=>[short(w.date),usd(w.income),usd(w.rent),usd(w.bills),usd(w.food),usd(w.debt),usd(w.close),editBtn('friday',w.date)])));
  }else if(view==='cash'){
    const ds=model.days.filter(d=>monthOf(d.date)===month||(m===model.months.at(-1)&&d.date===plan.end));
    body=panel('Saldo por día',table(['Día','Ingresos','Salidas','Mínimos desde deuda','Caja al cierre','Falta para el fondo','Con ahorro semanal'],ds.map(d=>['<button class="link" data-jump="'+d.date+'">'+short(d.date)+'</button>',usd(d.income),usd(d.out),usd(d.minimum),usd(d.cash),d.gap?tag(usd(d.gap),'warn'):'—',usd(d.scenario)])))+'<p class="footnote">Caja reserva los mínimos completos. Los pagos ya acreditados reducen el pendiente que ves en Mi semana.</p>';
  }else if(view==='budget'){
    body=panel('Importes del plan','<div class="fieldlist">'+Object.entries(fields).map(([k,n])=>'<button data-edit="budget" data-id="'+k+'"><span>'+esc(n)+'</span><b>'+usd(plan.settings[k])+'</b>'+icon('edit',15)+'</button>').join('')+'</div>');
  }else if(view==='bills'){
    body=panel('Facturas del mes',table(['Factura','Día habitual','Importe previsto',''],plan.bills.map(b=>[esc(b.name),b.day?'Día '+b.day:'Distribuido por viernes',b.amounts[month]!=null?usd(b.amounts[month]):'Por completar',editBtn('bill',b.id)])),'<button class="smallbtn" data-action="newbill">'+icon('plus',15)+' Añadir factura</button>')+
      '<div class="summaryline"><span>Presupuesto de servicios del mes</span><b>'+usd(m.billBudget)+'</b></div>';
  }else if(view==='cards'){
    body='<div class="cardgrid">'+plan.cards.map((c,i)=>'<article class="panel bank"><div class="banktop"><span class="bankicon tone'+(i%4)+'">'+icon('card',23)+'</span>'+editBtn('card',c.id)+'</div><h2>'+esc(c.name)+'</h2><strong>'+usd(c.balance)+'</strong><p>Saldo de referencia</p><dl><div><dt>APR de compras</dt><dd>'+(c.apr==null?'Pendiente':(c.apr/100).toFixed(2)+' %')+'</dd></div><div><dt>Mínimo inicial</dt><dd>'+usd(c.minimum)+'</dd></div></dl></article>').join('')+'</div>';control='<button class="primary" data-action="newcard">'+icon('plus',16)+' Añadir tarjeta</button>';
  }else{
    const sends=view==='sends';body=panel(sends?'Pagos por enviar':'Estados del mes',table(sends?['Tarjeta','Enviar el','Vence','Mínimo','Desde comida','Enviar desde deuda','Estado','']:['Tarjeta','Vence','Mínimo','Acreditado','Interés del estado','Saldo de cierre','Estado',''],m.statements.map(a=>sends?[esc(a.card.name),short(a.send),short(a.due),usd(a.minimum),usd(a.fromFood),a.minimum==null||a.pending==null?'Pendiente':usd(a.pending),tag(a.status,a.confirmed?'':'warn'),editBtn('statement',a.id)]:[esc(a.card.name),short(a.due),usd(a.minimum),usd(a.paid),usd(a.st.interest),usd(a.st.balance),tag(a.status,a.confirmed?'':'warn'),editBtn('statement',a.id)]),'Este mes inicial solo incluye apartados. Los estados comienzan el mes siguiente.'));
    if(sends)body+=panel('Abono adicional','<div class="summaryline"><span>'+esc(m.card?.name??'Elige una tarjeta')+'</span><b>'+usd(m.extra)+'</b></div><p class="footnote">'+(m.margin<=0?'El flujo proyectado necesita ese efectivo para los próximos vencimientos.':m.missing?'Completa los mínimos y fechas del mes antes de enviar el extra.':'Revisa el saldo y el APR vigente antes de pagar.')+'</p>',editBtn('priority','',month));
  }
  return title(n[1],descriptions[view],control)+body;
}
function draw(){sidebar();const n=nav.find(x=>x[0]===view);document.title=n[1]+' · ClearDebt';$('crumb').textContent=n[1];$('main').innerHTML=view==='week'?weekPage():otherPage();if(view==='week')requestAnimationFrame(plot);}
let bindings=[],activeEditor=null,imported=null;
function openDialog(html){$('dialog-content').innerHTML=html;if(!dialog.open)dialog.showModal();}
function dialogTitle(t,sub=''){return '<div class="dialoghead"><div><h2>'+esc(t)+'</h2>'+(sub?'<p>'+esc(sub)+'</p>':'')+'</div><button class="iconbtn" aria-label="Cerrar" data-action="done">×</button></div>';}
function editor(kind,id='',m=month){
  const defs=[];let heading='',hint='';
  const field=(label,type,loc,options={})=>defs.push({label,type,loc,...options});
  const card=plan.cards.find(c=>c.id===id),bill=plan.bills.find(b=>b.id===id),ci=plan.cards.indexOf(card),bi=plan.bills.indexOf(bill);
  const cardOptions=plan.cards.map(c=>[c.id,c.name]);
  if(kind==='budget'){heading=fields[id];hint='Este importe se utiliza para recalcular el calendario.';field('Importe en USD','money',['settings',id]);if(id==='food')field('Pagar comestibles con','choice',['foodCard'],{optional:true,options:cardOptions});}
  if(kind==='card'&&card){heading='Editar tarjeta';hint=card.name;const f=(n,t,k,o={})=>field(n,t,['cards',ci,k],o);
    f('Nombre','text','name');f('Saldo de referencia · USD','money','balance');f('APR de compras · %','pct','apr',{optional:true});
    f('Mínimo del primer estado · USD','money','minimum',{optional:true});f('Día de vencimiento inicial','day','dueDay',{optional:true});
  }
  if(kind==='bill'&&bill){heading='Editar factura';hint=monthText(m);field('Nombre','text',['bills',bi,'name']);field('Día habitual de pago','day',['bills',bi,'day'],{optional:true,help:'Vacío para distribuir el importe entre los viernes.'});field('Importe de este mes · USD','money',['bills',bi,'amounts',m],{optional:true});}
  if(kind==='friday'){const i=plan.weeks.findIndex(w=>w.date===id);if(i<0)return;
    heading='Editar viernes';hint=cap(long(id));field('Cobro previsto específico · USD','money',['weeks',i,'base'],{optional:true,help:'Vacío para usar el ingreso habitual.'});
    field('Cobro corregido · USD','money',['weeks',i,'override'],{optional:true,help:'Escribe 0 si ese depósito no llega.'});field('Apartado de servicios esta semana · USD','money',['weeks',i,'billsOverride'],{optional:true});}
  if(kind==='statement'&&card){const key=m+'/'+id,first=m===model.months[1]?.key;
    const a=model.statements.find(s=>s.key===m&&s.id===id);heading='Revisar estado';hint=card.name+' · '+monthText(m)+(a?' · Mínimo '+usd(a.minimum)+' · Vence '+short(a.due):'');const f=(n,t,k,o={})=>field(n,t,['statements',key,k],{optional:true,...o});
    f('Mínimo confirmado · USD','money','minimum',{help:first?'Si lo dejas vacío, se usa el mínimo inicial de Tarjetas.':'Escribe 0 únicamente si el emisor indica que no hay mínimo.'});f('Fecha de vencimiento','date','dueDate',{month:m});f('Total ya acreditado · USD','money','paid');
    f('Interés del estado · USD','money','interest');f('Saldo de cierre · USD','money','balance');
    if(plan.foodCard===id){f('Comida aplicable al mínimo · USD','money','foodCredit');f('De lo acreditado, cuánto fue comida · USD','money','foodPaid');}
  }
  if(kind==='priority'){heading='Prioridad de pago';hint=monthText(m);field('Tarjeta para el extra','choice',['priorities',m,'card'],{optional:true,options:cardOptions});field('Saldo máximo para este extra · USD','money',['priorities',m,'cap'],{optional:true,help:'Vacío para utilizar el saldo de referencia disponible.'});}
  if(!defs.length)return;activeEditor={kind,id,m};bindings=defs;
  const fieldHtml=defs.map((f,i)=>{
    const value=f.loc.reduce((o,k)=>o?.[k],plan),v=value==null?'':(f.type==='money'||f.type==='pct'?(value/100).toFixed(2):value);
    let el;if(f.type==='choice')el='<select id="fld'+i+'" data-field="'+i+'">'+(f.optional?'<option value="">Sin asignar</option>':'')+f.options.map(([k,n])=>'<option value="'+esc(k)+'" '+(k===v?'selected':'')+'>'+esc(n)+'</option>').join('')+'</select>';
    else{let at=f.type==='text'?'type="text" maxlength="100"':f.type==='date'?'type="date" min="'+f.month+'-01" max="'+addDays(addDays(f.month+'-01',32).slice(0,7)+'-01',-1)+'"':'type="number" min="'+(f.type==='day'?'1':'0')+'" max="'+(f.type==='day'?31:f.type==='pct'?100:999999999.99)+'" step="'+(f.type==='day'?'1':'0.01')+'"';
      el='<input id="fld'+i+'" data-field="'+i+'" '+at+' value="'+esc(v)+'" '+(!f.optional?'required':'')+' placeholder="'+(f.optional?'Pendiente':'')+'">';}
    return '<label class="formfield" for="fld'+i+'"><span>'+esc(f.label)+'</span>'+el+(f.help?'<small>'+esc(f.help)+'</small>':'')+'</label>';
  }).join('');
  openDialog(dialogTitle(heading,hint)+'<div class="editform">'+fieldHtml+'<p class="formerror" id="formerror" role="alert"></p></div><div class="dialogfoot"><span>'+icon('cloud',15)+' Guardado automático</span><button class="primary" data-action="done">Listo</button></div>');
}
function editInput(el){
  const f=bindings[Number(el.dataset.field)];if(!f)return false;
  const error=$('formerror');el.setCustomValidity('');
  if(!el.checkValidity()){error.textContent='Revisa el valor antes de cerrar.';return false;}
  const raw=el.value.trim();let value=raw;
  if(!raw){if(!f.optional){el.setCustomValidity('Completa este campo.');error.textContent='Completa este campo.';return false;}value=null;}
  else if(f.type==='money'||f.type==='pct')value=Math.round(Number(raw)*100);
  else if(f.type==='day')value=Number(raw);
  const next=structuredClone(plan);let target=next;
  for(const k of f.loc.slice(0,-1))target=target[k]??=(f.loc[0]==='priorities'?{card:null,cap:null}:{});
  target[f.loc.at(-1)]=value;
  try{validate(next);error.textContent='';if(JSON.stringify(next)!==JSON.stringify(plan)){plan=next;changed();}return true;}
  catch(e){error.textContent=e.message;el.setCustomValidity(e.message);return false;}
}
dialog.addEventListener('input',e=>{if(e.target.matches('[data-field]'))editInput(e.target);});
function finish(){if(activeEditor){for(const el of dialog.querySelectorAll('[data-field]'))if(!editInput(el)){el.reportValidity();el.focus();return;}void flush();}
  dialog.close();activeEditor=null;bindings=[];imported=null;}
dialog.addEventListener('cancel',e=>{e.preventDefault();finish();});
function backup(){
  activeEditor=null;bindings=[];
  openDialog(dialogTitle('Datos y respaldo')+'<div class="backupbody"><div class="storagecard">'+icon('shield',24)+'<div><b>'+(local?'Archivo privado en este equipo':'Datos de este navegador')+'</b><p>'+(local?'Las ediciones se guardan en la carpeta .local del proyecto.':'Descarga una copia para conservar el plan al cambiar de navegador o dispositivo.')+'</p></div></div><button class="secondary wide" data-action="export">Descargar respaldo JSON</button><label class="filelabel">Restaurar un respaldo<input type="file" accept=".json,application/json" id="upload"></label><p id="import-message" role="status"></p></div>');
}
function go(v){location.hash=v;if(view===v){draw();$('rail').classList.remove('open');}}
window.addEventListener('hashchange',()=>{if(!plan)return;view=nav.some(x=>x[0]===location.hash.slice(1))?location.hash.slice(1):'week';draw();$('rail').classList.remove('open');window.scrollTo(0,0);});
function setWeek(d){if(d<monday(plan.start)||d>monday(plan.end))return;const offset=(weekday(selected)+6)%7;week=d;selected=addDays(d,offset);if(!model.byDate.has(selected))selected=model.days.find(v=>v.date>=d)?.date??plan.end;remember();draw();}
document.addEventListener('change',async e=>{
  const t=e.target;if(t.dataset.action==='month'){month=t.value;remember();draw();}if(t.dataset.action==='week')setWeek(t.value);
  if(t.id==='upload'&&t.files[0]){try{if(t.files[0].size>2_000_000)throw Error('El archivo supera el tamaño admitido.');imported=validate(JSON.parse(await t.files[0].text()));$('import-message').innerHTML='El respaldo contiene '+imported.cards.length+' tarjetas. <button data-action="restore" class="primary">Reemplazar el plan actual</button>';}catch(err){imported=null;$('import-message').textContent=err.message;}}
});
document.addEventListener('click',e=>{
  const t=e.target.closest('button,a');if(!t)return;
  if(t.id==='menu'){$('rail').classList.toggle('open');return;}
  if(t.id==='save'){if(failed&&!conflict)void flush();else backup();return;}
  if(t.dataset.cashcontext){month=model.months.some(m=>m.key===monthOf(selected))?monthOf(selected):model.months.at(-1).key;remember();}
  if(t.matches('.navlink'))$('rail').classList.remove('open');
  if(t.dataset.day){selected=t.dataset.day;remember();draw();return;}
  if(t.dataset.gocash){month=t.dataset.gocash;remember();go('cash');return;}
  if(t.dataset.jump){selected=t.dataset.jump;week=monday(selected);remember();go('week');return;}
  if(t.dataset.edit){editor(t.dataset.edit,t.dataset.id,t.dataset.month??month);return;}
  if(t.dataset.event!=null){const ev=model.byDate.get(selected).events[+t.dataset.event];
    if(ev.tab==='bills'&&!ev.id){month=ev.month;remember();go('bills');return;}
    editor(({fridays:'friday',budget:'budget',bills:'bill',dues:'statement',sends:'priority'})[ev.tab],ev.id??'',ev.month??month);return;}
  switch(t.dataset.action){
    case 'prev':setWeek(addDays(week,-7));break;
    case 'next':setWeek(addDays(week,7));break;
    case 'savings':editor('budget','saving');break;
    case 'done':finish();break;
    case 'backup':backup();break;
    case 'newbill':{const id='b'+crypto.randomUUID();plan.bills.push({id,name:'Nueva factura',day:null,amounts:{}});changed();editor('bill',id);break;}
    case 'newcard':{const id='c'+crypto.randomUUID();plan.cards.push({id,name:'Nueva tarjeta',balance:0,apr:null,minimum:null,dueDay:null});changed();editor('card',id);break;}
    case 'export':{const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(plan,null,2)],{type:'application/json'}));a.href=url;a.download='respaldo-agenda-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);break;}
    case 'restore':if(imported&&!conflict){plan=imported;model=compute(plan);setSelections();dialog.close();imported=null;changed();void flush();}break;
  }
});
start();
