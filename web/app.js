import {validate,compute,blankPlan,cardProgress,debitProgress,fields,addDays,monday,monthOf,dates,weekday} from './model.js';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const usd=(v,digits=2)=>v==null?'Pendiente':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:digits,maximumFractionDigits:digits}).format(v/100);
const dateText=(d,opts)=>d?new Intl.DateTimeFormat('es-US',{timeZone:'UTC',...opts}).format(new Date(d+'T12:00:00Z')):'Pendiente';
const short=d=>dateText(d,{day:'numeric',month:'short'});
const long=d=>dateText(d,{weekday:'long',day:'numeric',month:'long'});
const cap=t=>t.charAt(0).toUpperCase()+t.slice(1);
const monthText=m=>cap(dateText(m+'-01',{month:'long',year:'numeric'}));
const currency=v=>usd(v,v%100===0?0:2);
const nav=[['week','Mi semana','calendar'],['sends','Envíos por tarjeta','send'],['monthly','Plan mensual','bars'],['fridays','Cada viernes','wallet'],['cash','Caja diaria','trend'],['budget','Presupuesto','sliders'],['bills','Gastos fijos','receipt'],['cards','Tarjetas','card'],['debit','Cuentas de débito','wallet'],['dues','Vencimientos','clock']];
const descriptions={sends:'Importes pendientes, fechas de envío y prioridad del mes.',monthly:'Distribución del dinero entre renta, servicios, comida y deuda.',fridays:'Los sobres que puedes apartar con cada cobro.',cash:'Entradas, salidas y efectivo proyectado al cierre de cada día.',budget:'Los importes de referencia de tu planificación.',bills:'Facturas por mes y día habitual de pago.',cards:'Saldos, tasas de compras y mínimos de tus tarjetas.',debit:'Saldos observados, depósitos ACH y pagos desde cada cuenta.',dues:'Estados de cuenta, vencimientos y pagos acreditados.'};
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
function monthlyPayments(m){
  const byCard=new Map(m.statements.map(s=>[s.id,s]));
  const summary='<div class="kpis">'+
    kpi('Apartado para deuda',usd(m.debt),'Distribución de los cobros del mes','wallet','feature')+
    kpi('En tránsito',usd(m.statements.reduce((n,s)=>n+s.transit,0)),'Envíos pendientes de acreditar','send')+
    kpi('Acreditado',usd(m.statements.reduce((n,s)=>n+s.paid,0)),'Pagos confirmados para los estados del mes','check')+'</div>';
  const cards=plan.cards.map(c=>{
    const s=byCard.get(c.id);
    const state=s?.status??'Sin estado inicial';
    const date=s?.send?'Enviar el '+short(s.send)+' · vence el '+short(s.due):state;
    return ['<strong>'+esc(c.name)+'</strong><small class="subcell">'+esc(date)+'</small>',
      usd(s?.minimum),usd(s?.transit??0),usd(s?.paid??0),
      '<strong>'+usd(s?.remaining)+'</strong>'+(s&&!s.confirmed&&s.minimum!=null?'<small class="subcell">Estimado</small>':''),
      '<button class="rowedit" data-pay-card="'+esc(c.id)+'" aria-label="Registrar envío a '+esc(c.name)+'">'+icon('plus',14)+' Registrar envío</button>'];
  });
  const guidance=m.extra>0?'<div class="summaryline"><span>Adicional previsto para '+esc(m.card.name)+' el '+short(m.weeks.at(-1).date)+'</span><b>'+usd(m.extra)+'</b></div>':'';
  const paymentsPanel=panel('Pagos de tarjetas · '+monthText(m.key),
    table(['Tarjeta','Mínimo','En tránsito','Acreditado','Mínimo por enviar',''],cards,'Añade una tarjeta en la pestaña Tarjetas para registrar un envío.')+guidance);
  const records=(plan.payments??[]).filter(e=>e.period===m.key).slice().reverse().sort((a,b)=>b.date.localeCompare(a.date));
  const rows=records.map(e=>{
    const card=plan.cards.find(c=>c.id===e.card),credited=e.status==='credited';
    const confirm=credited?'':'<button class="smallbtn" data-credit-payment="'+esc(e.id)+'">Marcar acreditado</button>';
    return [short(e.date),esc(card.name),e.source==='food'?'Comida':'Deuda',usd(e.amount),tag(credited?'Acreditado':'En tránsito',credited?'':'warn'),
      '<div class="payment-actions">'+confirm+'<button class="rowedit" data-pay-id="'+esc(e.id)+'">Editar</button></div>'];
  });
  for(const s of m.statements.filter(a=>a.st.paid>0)){
    rows.push(['Sin fecha',esc(s.card.name),'Estado previo',usd(s.st.paid),tag('Acreditado'),editBtn('statement',s.id,m.key)]);
  }
  return summary+paymentsPanel+panel('Historial de envíos del estado',table(['Fecha de envío','Tarjeta','Origen','Importe','Estado',''],rows,'Todavía no hay pagos registrados para este mes.'));
}
function otherPage(){
  const n=nav.find(v=>v[0]===view),m=model.months.find(x=>x.key===month);
  let body='',control=['monthly','sends','fridays','dues','bills','cash'].includes(view)?monthSelect():'';
  if(view==='monthly'){
    body=monthlyPayments(m)+panel('Distribución mensual',table(['Mes','Cobros','Renta siguiente','Servicios','Comida','Para deuda','Fondo al cierre'],model.months.map(m=>['<button class="link" data-gocash="'+m.key+'">'+monthText(m.key)+'</button>',usd(m.income),usd(m.rent),usd(m.bills),usd(m.food),usd(m.debt),usd(m.close)])))+'<p class="footnote">El fondo al cierre excluye los sobres apartados. Caja diaria muestra las salidas en la fecha del envío.</p>';
  }else if(view==='fridays'){
    body=panel('Sobres de cada cobro',table(['Viernes','Cuenta prevista','Cobro','Renta','Servicios','Comida','Para deuda','Fondo al cierre',''],m.weeks.map(w=>[short(w.date),esc((plan.debitAccounts??[]).find(a=>a.id===plan.incomeAccount)?.name??'Sin asignar'),usd(w.income),usd(w.rent),usd(w.bills),usd(w.food),usd(w.debt),usd(w.close),editBtn('friday',w.date)])));
  }else if(view==='cash'){
    const ds=model.days.filter(d=>monthOf(d.date)===month||(m===model.months.at(-1)&&d.date===plan.end));
    body=panel('Saldo por día',table(['Día','Ingresos','Salidas','Mínimos aún reservados','Caja al cierre','Falta para el fondo','Con ahorro semanal'],ds.map(d=>['<button class="link" data-jump="'+d.date+'">'+short(d.date)+'</button>',usd(d.income),usd(d.out),usd(d.minimum),usd(d.cash),d.gap?tag(usd(d.gap),'warn'):'—',usd(d.scenario)])))+'<p class="footnote">Cada envío registrado figura en su fecha de salida. Los mínimos pendientes mantienen su reserva en la fecha prevista.</p>';
  }else if(view==='budget'){
    body=panel('Importes del plan','<div class="fieldlist">'+Object.entries(fields).map(([k,n])=>'<button data-edit="budget" data-id="'+k+'"><span>'+esc(n)+'</span><b>'+usd(plan.settings[k])+'</b>'+icon('edit',15)+'</button>').join('')+'</div>');
  }else if(view==='bills'){
    body=panel('Facturas del mes',table(['Factura','Día habitual','Importe previsto',''],plan.bills.map(b=>[esc(b.name),b.day?'Día '+b.day:'Distribuido por viernes',b.amounts[month]!=null?usd(b.amounts[month]):'Por completar',editBtn('bill',b.id)])),'<button class="smallbtn" data-action="newbill">'+icon('plus',15)+' Añadir factura</button>')+
      '<div class="summaryline"><span>Presupuesto de servicios del mes</span><b>'+usd(m.billBudget)+'</b></div>';
  }else if(view==='cards'){
    body='<p class="footnote">El saldo restante es una estimación a partir del saldo de referencia y los envíos acreditados registrados en esta agenda. Compras, intereses y comisiones posteriores requieren actualizar el saldo de referencia.</p><div class="cardgrid">'+plan.cards.map((c,i)=>{
      const progress=cardProgress(plan,c.id);
      return '<article class="panel bank"><div class="banktop"><span class="bankicon tone'+(i%4)+'">'+icon('card',23)+'</span>'+editBtn('card',c.id)+'</div><h2>'+esc(c.name)+'</h2><strong>'+usd(progress.remaining)+'</strong><p>Saldo restante estimado</p><dl><div><dt>Saldo de referencia</dt><dd>'+usd(c.balance)+'</dd></div><div><dt>Pagos acreditados</dt><dd>'+usd(progress.credited)+'</dd></div><div><dt>En tránsito</dt><dd>'+usd(progress.transit)+'</dd></div><div><dt>APR de compras</dt><dd>'+(c.apr==null?'Pendiente':(c.apr/100).toFixed(2)+' %')+'</dd></div><div><dt>Mínimo inicial</dt><dd>'+usd(c.minimum)+'</dd></div></dl></article>';
    }).join('')+'</div>';control='<button class="primary" data-action="newcard">'+icon('plus',16)+' Añadir tarjeta</button>';
  }else if(view==='debit'){
    const accounts=plan.debitAccounts??[],deposits=plan.deposits??[];
    control='<button class="primary" data-action="newaccount">'+icon('plus',16)+' Añadir cuenta</button>';
    body='<p class="footnote">Actualiza el saldo de cada cuenta cuando lo consultes en el banco. Los depósitos y pagos registrados después de ese saldo modifican la estimación. Cada viernes muestra la cuenta del cobro previsto.</p>'+
      '<div class="cardgrid">'+accounts.map(a=>{const v=debitProgress(plan,a.id);return '<article class="panel bank"><div class="banktop">'+icon('wallet',22)+'<button class="rowedit" data-edit-account="'+esc(a.id)+'">Editar saldo</button></div><h2>'+esc(a.name)+'</h2>'+(a.id===plan.incomeAccount?tag('Recibe nómina semanal'):'<button class="link" data-income-account="'+esc(a.id)+'">Usar para cobro semanal</button>')+'<strong>'+usd(v.balance)+'</strong><p>Disponible estimado</p><dl><div><dt>Último saldo observado</dt><dd>'+usd(a.balance)+'</dd></div><div><dt>Depósitos posteriores</dt><dd>'+usd(v.income)+'</dd></div><div><dt>Pagos posteriores</dt><dd>'+usd(v.out)+'</dd></div></dl><button class="smallbtn account-deposit" data-new-deposit="'+esc(a.id)+'">Registrar depósito</button></article>';}).join('')+'</div>'+
      panel('Movimientos asociados',table(['Fecha','Cuenta','Concepto','Importe',''],[
        ...deposits.map(d=>[short(d.date),esc(accounts.find(a=>a.id===d.account)?.name),d.kind==='ach'?'Nómina ACH':'Abono variable','+'+usd(d.amount),'<button class="rowedit" data-edit-deposit="'+esc(d.id)+'">Editar</button>']),
        ...(plan.payments??[]).filter(e=>e.account).map(e=>[short(e.date),esc(accounts.find(a=>a.id===e.account)?.name),'Pago a '+esc(plan.cards.find(c=>c.id===e.card)?.name),'-'+usd(e.amount),'<button class="rowedit" data-pay-id="'+esc(e.id)+'">Editar</button>'])
      ].sort((a,b)=>b[0].localeCompare(a[0])),'Aún no hay depósitos ni pagos vinculados a una cuenta.'));
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
function paymentEditor(cardId,period,id){
  const existing=id?(plan.payments??[]).find(e=>e.id===id):null;
  const card=plan.cards.find(c=>c.id===(existing?.card??cardId));
  if(!card||(id&&!existing))return;
  period=existing?.period??period;
  const statement=model.statements.find(s=>s.id===card.id&&s.key===period);
  const now=new Date(),today=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
  const last=addDays(plan.end,-1),latest=today<last?today:last;
  if(latest<plan.start){notice('Puedes registrar un envío a partir del '+short(plan.start)+'.');return;}
  const select=(name,options,value)=>'<select name="'+name+'">'+options.map(([k,v])=>'<option value="'+esc(k)+'" '+(value===k?'selected':'')+'>'+esc(v)+'</option>').join('')+'</select>';
  const field=(label,input)=>'<label class="formfield"><span>'+label+'</span>'+input+'</label>';
  const sources=[['debt','Apartado para deuda']];
  if(card.id===plan.foodCard||existing?.source==='food')sources.push(['food','Presupuesto de comida']);
  const source=existing?.source??(card.id===plan.foodCard?'food':'debt');
  activeEditor=null;bindings=[];
  openDialog(dialogTitle(existing?'Editar envío':'Registrar envío',card.name+' · '+monthText(period))+
    '<form id="payment-form" data-card="'+esc(card.id)+'" data-id="'+esc(existing?.id??'')+'"><div class="editform">'+
    field('Mes del estado',select('period',model.months.map(m=>[m.key,monthText(m.key)]),period))+
    field('Fecha en que enviaste el dinero','<input required type="date" name="date" min="'+plan.start+'" max="'+latest+'" value="'+(existing?.date??latest)+'">')+
    field('Importe enviado · USD','<input required name="amount" type="number" min="0.01" max="999999999.99" step="0.01" inputmode="decimal" placeholder="0.00" value="'+(existing?(existing.amount/100).toFixed(2):'')+'">')+
    (!existing?'<button type="button" class="link use-minimum" data-action="useminimum" '+(statement?.remaining>0?'':'hidden')+'>Usar mínimo por enviar · '+usd(statement?.remaining)+'</button>':'')+
    field('Origen del dinero',select('source',sources,source))+
    field('Cuenta que envió el dinero',select('account',[['','Sin identificar'],...(plan.debitAccounts??[]).map(a=>[a.id,a.name])],existing?.account??''))+
    field('Estado del pago',select('status',[['sent','Enviado · pendiente de acreditar'],['credited','Acreditado por la tarjeta']],existing?.status??'sent'))+
    '<p class="footnote">Registra el importe que ya enviaste desde tu banco. También puedes registrar un abono adicional al mínimo.</p><p class="formerror" role="alert" id="payment-error"></p>'+
    (existing?'<details class="remove-payment"><summary>Corregir un registro duplicado</summary><button type="button" class="rowedit" data-remove-payment="'+esc(id)+'">Eliminar este registro del plan</button></details>':'')+
    '</div><div class="dialogfoot"><button class="secondary" type="button" data-action="done">Cancelar</button><button type="submit" class="primary">'+(existing?'Guardar cambios':'Guardar envío')+'</button></div></form>');
}
function savePayments(payments,message){
  if(conflict){notice('Recarga o respalda tus cambios antes de registrar otro pago.');return false;}
  const next={...plan,payments};
  try{validate(next);}catch(error){
    if($('payment-error'))$('payment-error').textContent=error.message;
    else notice(error.message);
    return false;
  }
  plan=next;changed();void flush();notice(message);return true;
}
function debitEditor(kind,id=''){
  const account=(plan.debitAccounts??[]).find(a=>a.id===id);
  const deposit=(plan.deposits??[]).find(d=>d.id===id);
  const selected=kind==='deposit'?deposit:account;
  const now=new Date(),today=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
  const field=(name,input)=>'<label class="formfield"><span>'+name+'</span>'+input+'</label>';
  const accountSelect='<select name="account">'+(plan.debitAccounts??[]).map(a=>'<option value="'+esc(a.id)+'" '+(a.id===(deposit?.account??id)?'selected':'')+'>'+esc(a.name)+'</option>').join('')+'</select>';
  activeEditor=null;bindings=[];
  openDialog(dialogTitle(kind==='deposit'?'Registrar depósito':account?'Editar cuenta':'Añadir cuenta',selected?.name??'')+
    '<form id="debit-form" data-kind="'+kind+'" data-id="'+esc(kind==='deposit'?deposit?.id??'':account?.id??'')+'"><div class="editform">'+
    (kind==='deposit'?field('Cuenta receptora',accountSelect)+field('Tipo de ingreso','<select name="kind"><option value="ach" '+(deposit?.kind==='ach'?'selected':'')+'>Nómina ACH</option><option value="variable" '+(deposit?.kind==='variable'?'selected':'')+'>Abono variable</option></select>')+
      field('Fecha de acreditación','<input name="date" required type="date" value="'+(deposit?.date??today)+'">')+
      field('Importe acreditado · USD','<input name="amount" required type="number" min="0.01" step="0.01" value="'+(deposit?(deposit.amount/100).toFixed(2):'')+'">'):
      field('Banco o nombre de cuenta','<input name="name" required maxlength="100" value="'+esc(account?.name??'')+'">')+
      field('Saldo disponible observado · USD','<input name="balance" type="number" min="0" step="0.01" placeholder="Pendiente" value="'+(account?.balance==null?'':(account.balance/100).toFixed(2))+'">')+
      '<p class="footnote">El saldo observado incluye los depósitos y pagos que el banco ya refleja. Los movimientos anteriores quedan incorporados como referencia.</p>')+
    '<p class="formerror" id="debit-error" role="alert"></p></div><div class="dialogfoot"><button class="secondary" type="button" data-action="done">Cancelar</button><button class="primary" type="submit">Guardar</button></div></form>');
}
dialog.addEventListener('submit',event=>{
  const form=event.target;if(form.id!=='debit-form')return;
  event.preventDefault();const values=new FormData(form),next=structuredClone(plan),id=form.dataset.id;
  if(form.dataset.kind==='account'){
    const included=[...(next.payments??[]).filter(e=>e.account===id).map(e=>'p:'+e.id),...(next.deposits??[]).filter(d=>d.account===id).map(d=>'d:'+d.id)];
    const balance=values.get('balance')===''?null:Math.round(Number(values.get('balance'))*100);
    const record={id:id||'a'+crypto.randomUUID(),name:String(values.get('name')).trim(),balance,included};
    next.debitAccounts=id?next.debitAccounts.map(a=>a.id===id?record:a):[...(next.debitAccounts??[]),record];
  }else{
    const record={id:id||'d'+crypto.randomUUID(),account:values.get('account'),kind:values.get('kind'),date:values.get('date'),amount:Math.round(Number(values.get('amount'))*100)};
    next.deposits=id?next.deposits.map(d=>d.id===id?record:d):[...(next.deposits??[]),record];
  }
  try{validate(next);plan=next;changed();void flush();finish();notice('Cuenta actualizada.');}catch(error){$('debit-error').textContent=error.message;}
});
dialog.addEventListener('submit',event=>{
  const form=event.target;
  if(form.id!=='payment-form')return;
  event.preventDefault();
  const values=new FormData(form),id=form.dataset.id,records=plan.payments??[];
  const entry={id:id||'p'+crypto.randomUUID(),card:form.dataset.card,period:values.get('period'),date:values.get('date'),
    amount:Math.round(Number(values.get('amount'))*100),source:values.get('source'),status:values.get('status'),account:values.get('account')||null};
  const updated=id?records.map(e=>e.id===id?entry:e):[...records,entry];
  if(savePayments(updated,'Envío registrado en el plan.')){
    month=entry.period;remember();finish();draw();
  }
});
function editor(kind,id='',m=month){
  const defs=[];let heading='',hint='';
  const field=(label,type,loc,options={})=>defs.push({label,type,loc,...options});
  const card=plan.cards.find(c=>c.id===id),bill=plan.bills.find(b=>b.id===id),ci=plan.cards.indexOf(card),bi=plan.bills.indexOf(bill);
  const cardOptions=plan.cards.map(c=>[c.id,c.name]);
  if(kind==='budget'){heading=fields[id];hint='Este importe se utiliza para recalcular el calendario.';field('Importe en USD','money',['settings',id]);if(id==='food')field('Pagar comestibles con','choice',['foodCard'],{optional:true,options:cardOptions});}
  if(kind==='card'&&card){heading='Editar tarjeta';hint=card.name;const f=(n,t,k,o={})=>field(n,t,['cards',ci,k],o);
    f('Nombre','text','name');f('Saldo de referencia · USD','money','balance',{help:'Base para calcular el saldo restante. Si registras un saldo bancario nuevo, revisa los pagos ya acreditados para evitar descontarlos dos veces.'});f('APR de compras · %','pct','apr',{optional:true});
    f('Mínimo del primer estado · USD','money','minimum',{optional:true});f('Día de vencimiento inicial','day','dueDay',{optional:true});
  }
  if(kind==='bill'&&bill){heading='Editar factura';hint=monthText(m);field('Nombre','text',['bills',bi,'name']);field('Día habitual de pago','day',['bills',bi,'day'],{optional:true,help:'Vacío para distribuir el importe entre los viernes.'});field('Importe de este mes · USD','money',['bills',bi,'amounts',m],{optional:true});}
  if(kind==='friday'){const i=plan.weeks.findIndex(w=>w.date===id);if(i<0)return;
    heading='Editar viernes';hint=cap(long(id));field('Cobro previsto específico · USD','money',['weeks',i,'base'],{optional:true,help:'Vacío para usar el ingreso habitual.'});
    field('Cobro corregido · USD','money',['weeks',i,'override'],{optional:true,help:'Escribe 0 si ese depósito no llega.'});field('Apartado de servicios esta semana · USD','money',['weeks',i,'billsOverride'],{optional:true});}
  if(kind==='statement'&&card){const key=m+'/'+id,first=m===model.months[1]?.key;
    const a=model.statements.find(s=>s.key===m&&s.id===id);heading='Revisar estado';hint=card.name+' · '+monthText(m)+(a?' · Mínimo '+usd(a.minimum)+' · Vence '+short(a.due):'');const f=(n,t,k,o={})=>field(n,t,['statements',key,k],{optional:true,...o});
    f('Mínimo confirmado · USD','money','minimum',{help:first?'Si lo dejas vacío, se usa el mínimo inicial de Tarjetas.':'Escribe 0 únicamente si el emisor indica que no hay mínimo.'});f('Fecha de vencimiento','date','dueDate',{month:m});f('Acreditado previo sin fecha · USD','money','paid',{help:'Solo pagos anteriores al historial. Los envíos que registras en Plan mensual se suman automáticamente.'});
    f('Interés del estado · USD','money','interest');f('Saldo de cierre · USD','money','balance');
    if(plan.foodCard===id){f('Comida aplicable al mínimo · USD','money','foodCredit');f('Del acreditado previo, cuánto fue comida · USD','money','foodPaid');}
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
  if(t.name==='period'&&t.form?.id==='payment-form'){
    const shortcut=t.form.querySelector('[data-action="useminimum"]');
    if(shortcut){
      const s=model.statements.find(s=>s.id===t.form.dataset.card&&s.key===t.value);
      shortcut.hidden=!(s?.remaining>0);shortcut.textContent='Usar mínimo por enviar · '+usd(s?.remaining);
    }
  }
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
  if(t.dataset.payCard){paymentEditor(t.dataset.payCard,month);return;}
  if(t.dataset.editAccount){debitEditor('account',t.dataset.editAccount);return;}
  if(t.dataset.incomeAccount){const next={...plan,incomeAccount:t.dataset.incomeAccount};validate(next);plan=next;changed();void flush();return;}
  if(t.dataset.newDeposit){debitEditor('deposit',t.dataset.newDeposit);return;}
  if(t.dataset.editDeposit){debitEditor('deposit',t.dataset.editDeposit);return;}
  if(t.dataset.payId){paymentEditor(null,null,t.dataset.payId);return;}
  if(t.dataset.creditPayment){
    const records=plan.payments??[],id=t.dataset.creditPayment;
    if(records.some(e=>e.id===id&&e.status==='sent'))savePayments(records.map(e=>e.id===id?{...e,status:'credited'}:e),'Pago marcado como acreditado.');
    return;
  }
  if(t.dataset.removePayment){
    if(savePayments((plan.payments??[]).filter(e=>e.id!==t.dataset.removePayment),'Registro eliminado del plan.'))finish();
    return;
  }
  if(t.dataset.edit){editor(t.dataset.edit,t.dataset.id,t.dataset.month??month);return;}
  if(t.dataset.event!=null){const ev=model.byDate.get(selected).events[+t.dataset.event];
    if(ev.tab==='payment'){paymentEditor(null,null,ev.id);return;}
    if(ev.tab==='bills'&&!ev.id){month=ev.month;remember();go('bills');return;}
    editor(({fridays:'friday',budget:'budget',bills:'bill',dues:'statement',sends:'priority'})[ev.tab],ev.id??'',ev.month??month);return;}
  switch(t.dataset.action){
    case 'newaccount':debitEditor('account');break;
    case 'useminimum':{
      const form=t.form,s=model.statements.find(a=>a.key===form.elements.period.value&&a.id===form.dataset.card);
      if(s?.remaining>0)form.elements.amount.value=(s.remaining/100).toFixed(2);
      break;
    }
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
