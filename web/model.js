const DAY = 86400000;
export const addDays = (d,n) => new Date(Date.parse(d+'T12:00:00Z')+n*DAY).toISOString().slice(0,10);
export const weekday = d => new Date(d+'T12:00:00Z').getUTCDay();
export const monthOf = d => d.slice(0,7);
export const monday = d => addDays(d,-((weekday(d)+6)%7));
const dayOf = d => Number(d.slice(8));
const monthEnd = m => new Date(Date.UTC(+m.slice(0,4),+m.slice(5),0)).getUTCDate();
const inMonth = (m,n) => m+'-'+String(Math.min(n,monthEnd(m))).padStart(2,'0');
export function dates(first,last,step=1) {
  const list=[];
  for(let d=first;d<=last;d=addDays(d,step)) list.push(d);
  return list;
}
const total = (a,key) => a.reduce((s,x)=>s+(x[key]??0),0);
const positive = n => Math.max(0,n);
const billLabel = b => String(b?.name ?? '').trim().toLowerCase();
const isFoodBill = b => /comida|comestible|mercado|grocer/.test(billLabel(b));
export const fields = {
  opening:'Efectivo inicial', income:'Cobro habitual del viernes',rent:'Renta mensual',bills:'Presupuesto de servicios',
  food:'Comestibles mensuales', goal:'Meta mensual de pagos', decTarget:'Aporte del primer mes completo',
  target:'Aporte mensual posterior',floor:'Fondo mínimo',firstBills:'Servicios del mes inicial',
  firstFood:'Comida del mes inicial',firstRent:'Primer apartado para renta',firstDebt:'Deuda a apartar en el mes inicial',saving:'Ahorro semanal de prueba'
};
const isDate = d => typeof d==='string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d+'T12:00:00Z')) && addDays(d,0)===d;
const amount = n => Number.isSafeInteger(n)&&n>=0&&n<=99999999999;
const maybe = (n,test=amount) => n===null||test(n);
const object = o => !!o&&typeof o==='object'&&!Array.isArray(o);
const ident = id => typeof id==='string'&&/^[a-z][a-z0-9-]{0,55}$/i.test(id);
const name = s=>typeof s==='string'&&s.trim().length>0&&s.length<=100;
const day = d=>Number.isInteger(d)&&d>=1&&d<=31;
export function validate(p) {
  const check=(ok,m)=>{if(!ok)throw Error(m)};
  check(object(p)&&p.version===1,'Formato de plan incompatible.');
  check(isDate(p.start)&&isDate(p.end)&&weekday(p.start)===5&&p.end>p.start&&dayOf(p.end)===1&&Date.parse(p.end)-Date.parse(p.start)<=2*366*DAY,'Periodo del plan inválido.');
  check(object(p.settings)&&Object.keys(fields).every(k=>amount(p.settings[k])),'Revisa los importes del presupuesto.');
  check(Array.isArray(p.cards)&&p.cards.length<=150&&Array.isArray(p.bills)&&p.bills.length<=200,'Cuentas o facturas inválidas.');
  const ids=new Set(p.cards.map(c=>c.id));
  check(ids.size===p.cards.length&&maybe(p.foodCard,id=>ids.has(id)),'Tarjeta de comida inválida.');
  for(const c of p.cards)check(ident(c.id)&&name(c.name)&&amount(c.balance)&&maybe(c.apr,n=>amount(n)&&n<=10000)&&maybe(c.minimum)&&maybe(c.dueDay,day),'Datos de tarjeta inválidos.');
  const fs=dates(p.start,addDays(p.end,-1)).filter(d=>weekday(d)===5);
  check(Array.isArray(p.weeks)&&p.weeks.length===fs.length&&p.weeks.every((w,i)=>w.date===fs[i]&&['base','override','billsOverride'].every(k=>maybe(w[k]))),'Revisa los cobros del calendario.');
  const ms=new Set(dates(p.start,addDays(p.end,-1)).map(monthOf));
  check(new Set(p.bills.map(b=>b.id)).size===p.bills.length,'Hay facturas repetidas.');
  for(const b of p.bills)check(ident(b.id)&&name(b.name)&&maybe(b.day,day)&&object(b.amounts)&&Object.entries(b.amounts).every(([m,n])=>ms.has(m)&&maybe(n)),'Revisa las facturas.');
  check(object(p.statements)&&object(p.priorities),'Faltan estados de cuenta.');
  for(const [key,s] of Object.entries(p.statements)){
    const [m,id]=key.split('/');
    check(ms.has(m)&&ids.has(id)&&key===m+'/'+id&&object(s)&&['minimum','paid','interest','balance','foodCredit','foodPaid'].every(k=>maybe(s[k]??null))&&maybe(s.dueDate??null,d=>isDate(d)&&monthOf(d)===m),'Estado de cuenta inválido.');
    check((s.foodPaid??0)<=(s.paid??0),'La parte acreditada desde comida supera el pago total.');
  }
  for(const [m,t] of Object.entries(p.priorities))check(ms.has(m)&&object(t)&&maybe(t.card,id=>ids.has(id))&&maybe(t.cap),'Prioridad mensual inválida.');
  const payments=p.payments===undefined?[]:p.payments;
  check(Array.isArray(payments),'Registro de pagos inválido.');
  const accounts=p.debitAccounts??[],deposits=p.deposits??[],outflows=p.debitOutflows??[],transfers=p.transfers??[];
  check(Array.isArray(accounts)&&accounts.length<=30&&Array.isArray(deposits)&&Array.isArray(outflows)&&Array.isArray(transfers),'Cuentas de débito inválidas.');
  const accountIds=new Set(accounts.map(a=>a.id));
  check(accountIds.size===accounts.length,'Hay cuentas de débito repetidas.');
  check(p.incomeAccount==null||accountIds.has(p.incomeAccount),'Cuenta receptora del ingreso inválida.');
  for(const a of accounts)check(ident(a.id)&&name(a.name)&&maybe(a.balance)&&Array.isArray(a.included)&&a.included.every(id=>typeof id==='string'),'Revisa la cuenta de débito.');
  const depositIds=new Set();
  for(const d of deposits){
    check(ident(d.id)&&!depositIds.has(d.id)&&accountIds.has(d.account)&&isDate(d.date)&&amount(d.amount)&&d.amount>0&&['ach','variable'].includes(d.kind),'Depósito inválido.');
    depositIds.add(d.id);
  }
  const outflowIds=new Set();
  for(const o of outflows){
    check(ident(o.id)&&!outflowIds.has(o.id)&&accountIds.has(o.account)&&name(o.name)&&isDate(o.date)&&amount(o.amount)&&o.amount>0&&['planned','posted'].includes(o.status),'Salida de débito inválida.');
    outflowIds.add(o.id);
  }
  const transferIds=new Set();
  for(const move of transfers){
    check(ident(move.id)&&!transferIds.has(move.id)&&accountIds.has(move.from)&&accountIds.has(move.to)&&move.from!==move.to&&isDate(move.date)&&amount(move.amount)&&move.amount>0&&['planned','posted'].includes(move.status),'Transferencia inválida.');
    transferIds.add(move.id);
  }
  const paymentIds=new Set();
  for(const entry of payments){
    check(object(entry)&&ident(entry.id)&&!paymentIds.has(entry.id)&&ids.has(entry.card)&&ms.has(entry.period)
      &&isDate(entry.date)&&entry.date>=p.start&&entry.date<p.end&&amount(entry.amount)&&entry.amount>0
      &&['debt','food'].includes(entry.source)&&['sent','credited'].includes(entry.status)
      &&(entry.account==null||accountIds.has(entry.account)),'Revisa la tarjeta, la fecha, el importe y el estado del envío.');
    paymentIds.add(entry.id);
  }
  return p;
}
function paymentIndex(payments){
  const byStatement=new Map(),byDate=new Map(),foodByMonth=new Map();
  function append(map,key,entry){
    if(!map.has(key))map.set(key,[]);
    map.get(key).push(entry);
  }
  for(const entry of payments){
    append(byStatement,entry.period+'/'+entry.card,entry);
    append(byDate,entry.date,entry);
    const month=monthOf(entry.date);
    if(entry.source==='food')foodByMonth.set(month,(foodByMonth.get(month)??0)+entry.amount);
  }
  return {byStatement,byDate,foodByMonth};
}
export function blankPlan() {
  const now=new Date(),today=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
  const start=addDays(today,-((weekday(today)+2)%7));
  const end=new Date(Date.UTC(+start.slice(0,4),+start.slice(5,7)+6,1)).toISOString().slice(0,10);
  return {version:1,start,end,settings:Object.fromEntries(Object.keys(fields).map(k=>[k,0])),cards:[],foodCard:null,bills:[],statements:{},priorities:{},weeks:dates(start,addDays(end,-1),7).map(date=>({date,base:null,override:null,billsOverride:null}))};
}
export function cardProgress(plan,cardId) {
  const card=plan.cards.find(c=>c.id===cardId);
  if(!card)return null;
  const payments=(plan.payments??[]).filter(p=>p.card===cardId);
  const credited=total(payments.filter(p=>p.status==='credited'),'amount');
  const transit=total(payments.filter(p=>p.status==='sent'),'amount');
  return {credited,transit,remaining:positive(card.balance-credited)};
}
export function debitProgress(plan,accountId) {
  const account=(plan.debitAccounts??[]).find(a=>a.id===accountId);
  if(!account)return null;
  const included=new Set(account.included);
  const deposits=(plan.deposits??[]).filter(d=>d.account===accountId&&!included.has('d:'+d.id));
  const payments=(plan.payments??[]).filter(p=>p.account===accountId&&!included.has('p:'+p.id));
  const outflows=(plan.debitOutflows??[]).filter(o=>o.account===accountId&&!included.has('o:'+o.id));
  const transfers=(plan.transfers??[]).filter(t=>(t.from===accountId||t.to===accountId)&&!included.has('t:'+t.id));
  const posted=transfers.filter(t=>t.status==='posted'),planned=transfers.filter(t=>t.status==='planned');
  const income=total(deposits,'amount')+total(posted.filter(t=>t.to===accountId),'amount');
  const out=total(payments,'amount')+total(outflows.filter(o=>o.status==='posted'),'amount')+total(posted.filter(t=>t.from===accountId),'amount');
  return {income,out,planned:total(outflows.filter(o=>o.status==='planned'),'amount')+total(planned.filter(t=>t.from===accountId),'amount'),balance:account.balance==null?null:account.balance+income-out};
}
export function compute(p) {
  const s=p.settings, weeks=[], statements=[], months=[], days=[], byDate=new Map(), byWeek=new Map();
  const period=dates(p.start,addDays(p.end,-1)), keys=[...new Set(period.map(monthOf))];
  const schedule=new Map(), previous=new Map();
  const ledger=paymentIndex(p.payments??[]);
  const outflowsByDate=new Map();
  for(const o of p.debitOutflows??[]){if(!outflowsByDate.has(o.date))outflowsByDate.set(o.date,[]);outflowsByDate.get(o.date).push(o);}
  let free=s.opening;
  for(const [mi,key] of keys.entries()){
    const list=p.weeks.filter(w=>monthOf(w.date)===key), count=list.length;
    const itemized=p.bills.reduce((sum,b)=>sum+(b.amounts[key]??0),0);
    const dated=p.bills.reduce((sum,b)=>sum+(b.day?b.amounts[key]??0:0),0);
    const billBudget=Math.max(mi?s.bills:s.firstBills,itemized);
    const foodBudget=mi?s.food:s.firstFood;
    const foodDated=p.bills.reduce((sum,b)=>sum+(isFoodBill(b)?(b.amounts[key]??0):0),0);
    // El presupuesto de comida es una referencia. Las facturas COMIDA/MERCADO
    // fechadas lo cubren primero; solo se proyecta la parte aún no desglosada.
    const food=Math.max(0,foodBudget-foodDated);
    const month={key,billBudget,dated,food,foodBudget,foodDated,weeks:[],statements:[],income:0,rent:0,bills:0,debt:0,min:0,extra:0,missing:0};
    // The statement can fall in the first days of the month, with funding the Friday before.
    let foodRemaining=food;
    for(const [i,base] of list.entries()){
      const slice=(n)=>Math.round(n*(i+1)/count)-Math.round(n*i/count);
      const foodThisFriday=Math.round(foodRemaining/(count-i));foodRemaining-=foodThisFriday;
      const w={...base,month:key,income:base.override??base.base??s.income,food:foodThisFriday,undated:slice(billBudget-dated)};
      month.weeks.push(w);weeks.push(w);byWeek.set(w.date,w);
    }
    for(const c of p.cards){
      const st=p.statements[key+'/'+c.id]??{}, prev=previous.get(c.id);
      const min=st.minimum??(mi===1?c.minimum:null);
      const fixedDate=st.dueDate??(mi===1&&c.dueDay?inMonth(key,c.dueDay):null);
      const minimum=min??(prev?.minimum>0?prev.minimum:null);
      const due=fixedDate??(prev?.due?inMonth(key,dayOf(prev.due)):null);
      const send=minimum>0&&due?addDays(due,-((weekday(due)+1)%7+1)):null;
      const isFood=c.id===p.foodCard;
      const foodAvailable=total(month.weeks.filter(w=>send&&w.date<=send),'food');
      const fromFood=isFood?Math.min(minimum??0,s.food,st.foodCredit??foodAvailable):0;
      const fromDebt=positive((minimum??0)-fromFood),legacyPaid=st.paid??0;
      const records=ledger.byStatement.get(key+'/'+c.id)??[];
      const transit=total(records.filter(e=>e.status==='sent'),'amount');
      const paid=legacyPaid+total(records.filter(e=>e.status==='credited'),'amount');
      const sentFromDebt=total(records.filter(e=>e.source==='debt'),'amount');
      const remaining=minimum==null?null:positive(minimum-paid-transit);
      const legacyDebt=positive(legacyPaid-(isFood?st.foodPaid??0:0));
      const unresolved=isFood&&fromDebt>0&&legacyPaid>0&&st.foodPaid==null&&remaining>0;
      const legacyDue=positive(fromDebt-legacyDebt);
      const beforeSends=Math.min(legacyDue,positive((minimum??0)-legacyPaid));
      const afterSends=Math.min(remaining??0,positive(legacyDue-sentFromDebt));
      const pending=unresolved?null:afterSends;
      // Keep undated legacy credits in the original cash forecast. Dated sends replace the reservation.
      const cashMinimum=fromDebt-(beforeSends-afterSends);
      const extraDebtSent=positive(sentFromDebt-beforeSends);
      const confirmed=min!=null&&(min===0||!!fixedDate);
      const status=minimum==null?(mi===0?'Sin estado inicial':'Confirmar mínimo'):minimum===0?'Sin mínimo':!due?'Confirmar fecha':unresolved?'Desglosar comida':!confirmed?'Estimado':paid>=minimum?'Cubierto':remaining===0?'Enviado':pending===0?'Desde comida':'Por pagar';
      const a={key,card:c,id:c.id,minimum,due,send,fromFood,fromDebt,paid,pending,remaining,transit,records,cashMinimum,extraDebtSent,status,confirmed,st};
      if(mi>0||Object.keys(st).length||records.length){
        month.missing+=Number(!confirmed||unresolved);previous.set(c.id,a);statements.push(a);month.statements.push(a);
      }
      if(send){if(!schedule.has(send))schedule.set(send,[]);schedule.get(send).push(a);}
    }
    months.push(month);
  }
  for(const [mi,m] of months.entries()){
    let rent=0,bills=0,debt=0,mins=0;
    for(const [i,w] of m.weeks.entries()){
      const left=m.weeks.length-i, last=left===1;
      w.rent=mi===0&&i===0?Math.min(s.firstRent,s.rent):Math.round(positive(s.rent-rent)/left);
      const billsLeft=Math.round(positive(m.billBudget-bills)/left);
      w.bills=last?Math.max(billsLeft,w.billsOverride??0):w.billsOverride??billsLeft;
      w.minimum=total((schedule.get(w.date)??[]).filter(a=>a.confirmed),'fromDebt');
      mins+=w.minimum;
      const target=mi===0?s.firstDebt:Math.min(s.goal,mi===1?s.decTarget:s.target);
      const goal=Math.round(target*(i+1)/m.weeks.length);
      w.open=free;
      w.debt=Math.min(positive(free+w.income-w.rent-w.bills-w.food-(mi?s.floor:0)),positive(Math.max(goal-debt,mins-debt)));
      free+=w.income-w.rent-w.bills-w.food-w.debt;
      w.close=free;rent+=w.rent;bills+=w.bills;debt+=w.debt;w.remaining=debt-mins;
    }
    Object.assign(m,{income:total(m.weeks,'income'),rent,bills,debt,close:free});
  }
  let cash=s.opening;
  const observedAccounts=(p.debitAccounts??[]).filter(a=>a.balance!=null);
  const observedCash=observedAccounts.length?observedAccounts.reduce((sum,a)=>sum+a.balance,0):null;
  const observedIds=new Set(observedAccounts.flatMap(a=>a.included??[]));
  const today=new Date().toISOString().slice(0,10);
  let anchored=false;
  for(const date of [...period,p.end]){
    if(!anchored&&observedCash!=null&&date>=today){cash=observedCash;anchored=true;}
    const m=months.find(x=>x.key===monthOf(date)), w=byWeek.get(date), events=[];
    const ev=(type,label,value,reference={},note='')=>{if(value>0)events.push({type,label,value,...reference,note});};
    if(w)ev('income','Cobro semanal',w.income,{tab:'fridays',id:date},'Ingreso previsto');
    // Renta tiene dos posibles fuentes: el importe mensual del presupuesto o
    // una factura fechada. Si existe una factura de renta/vivienda ese día,
    // la factura es la única fuente para evitar cobrarla dos veces.
    const datedRent = m && p.bills.some(b => {
      return b.day && inMonth(m.key,b.day)===date && /renta|vivienda/.test(billLabel(b)) && (b.amounts[m.key]??0)>0;
    });
    if(dayOf(date)===1 && !datedRent)ev('rent','Renta',s.rent,{tab:'budget',id:'rent'},'Vivienda');
    if(m) for(const b of p.bills)if(b.day&&inMonth(m.key,b.day)===date)ev('bill',b.name,b.amounts[m.key],{tab:'bills',id:b.id,month:m.key},'Factura del mes');
    if(w){ev('undated','Gastos sin fecha',w.undated,{tab:'bills',month:m.key},'Apartado semanal');
      const replaced=Math.min(w.food,ledger.foodByMonth.get(m.key)??0);
      ledger.foodByMonth.set(m.key,(ledger.foodByMonth.get(m.key)??0)-replaced);
      ev('food',p.cards.find(c=>c.id===p.foodCard)?.name??'Comestibles',w.food-replaced,{tab:'budget',id:'food'},'Tope de comestibles');}
    const actual=(ledger.byDate.get(date)??[]).filter(entry=>!observedIds.has('p:'+entry.id));
    for(const entry of actual){
      const card=p.cards.find(c=>c.id===entry.card);
      ev('card',card.name,entry.amount,{tab:'payment',id:entry.id,month:entry.period},entry.status==='credited'?'Pago acreditado':'Enviado · en tránsito');
    }
    const otherOutflows=(outflowsByDate.get(date)??[]).filter(entry=>!observedIds.has('o:'+entry.id));
    for(const entry of otherOutflows)ev('other',entry.name,entry.amount,{tab:'outflow',id:entry.id},entry.status==='posted'?'Salida realizada':'Salida prevista');
    const sends=schedule.get(date)??[];
    for(const a of sends)ev('card',a.card.name,a.pending,{tab:'dues',id:a.id,month:a.key},a.confirmed?'Mínimo pendiente':'Mínimo estimado');
    const required=total(sends,'cashMinimum'),spending=total(events.filter(e=>!['income','card'].includes(e.type)),'value');
    const out=spending+required+total(actual,'amount');
    cash+=(w?.income??0)-out;
    const priority=['card','extra','food','rent','bill','undated','income'];
    events.sort((a,b)=>priority.indexOf(a.type)-priority.indexOf(b.type));
    const d={date,events,income:w?.income??0,out,minimum:required,base:cash,extra:0,cash};
    if(m)m.debtCommitted=(m.debtCommitted??0)+required+total(actual.filter(e=>e.source==='debt'),'amount');
    days.push(d);byDate.set(date,d);
  }
  let low=Infinity;
  for(let i=days.length-1;i>=0;i--){low=Math.min(low,days[i].base);days[i].futureLow=low;}
  let extras=0, paydayCount=0;
  for(const d of days){
    const m=months.find(x=>x.key===monthOf(d.date));
    if(byWeek.has(d.date))paydayCount++;
    if(m&&d.date===m.weeks.at(-1)?.date){
      const pref=p.priorities[m.key]??{},c=p.cards.find(x=>x.id===pref.card);
      const a=m.statements.find(x=>x.id===pref.card),i=months.indexOf(m);
      m.min=total(statements.filter(x=>x.send&&monthOf(x.send)===m.key),'fromDebt');
      const cap=pref.cap??(i<=1&&c?positive(c.balance-(a?.minimum??0)):(a?.st.balance!=null?positive(a.st.balance-(a.minimum??0)):null));
      m.margin=d.futureLow-s.floor-extras;m.card=c;m.cap=cap;
      m.extra=i>0&&!m.missing&&c&&cap!=null?positive(Math.min(m.debt-m.debtCommitted,cap-(a?.extraDebtSent??0),m.margin)):0;
      if(m.extra){d.events.push({type:'extra',label:c.name,value:m.extra,tab:'sends',month:m.key,note:'Abono adicional'});d.extra=m.extra;d.out+=m.extra;extras+=m.extra;}
    }
    d.cash=d.base-extras;d.scenario=d.cash+paydayCount*s.saving;d.gap=positive(s.floor-d.cash);
  }
  return {days,weeks,byDate,byWeek,statements,months,low:Math.min(...days.map(d=>d.cash)),last:days.at(-1)};
}
