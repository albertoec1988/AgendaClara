import test from 'node:test';
import assert from 'node:assert/strict';
import {blankPlan,compute,validate,dates,addDays} from '../web/model.js';

function sample(){
  const p=blankPlan();p.start='2028-01-21';p.end='2028-04-01';
  p.settings={...p.settings,opening:900000,income:80000,rent:160000,food:40000,bills:20000,goal:30000,decTarget:30000,target:30000,floor:5000,saving:500};
  p.weeks=dates(p.start,addDays(p.end,-1),7).map(date=>({date,base:null,override:null,billsOverride:null}));
  p.cards=[{id:'c1',name:'Tarjeta A',balance:150000,apr:null,minimum:3500,dueDay:10},{id:'c2',name:'Tarjeta B',balance:180000,apr:1800,minimum:6000,dueDay:15}];
  p.foodCard='c1';p.bills=[{id:'b1',name:'Gas',day:31,amounts:{'2028-02':26000}}];p.priorities={'2028-02':{card:'c2',cap:10000}};
  return p;
}
test('los mínimos de comida se cuentan una sola vez y un pago acreditado reduce el pendiente',()=>{
  const p=sample(),id='2028-02/c2';p.statements[id]={paid:2500};
  const model=compute(validate(p)),a=model.statements.find(x=>x.key==='2028-02'&&x.id==='c1'),b=model.statements.find(x=>x.key==='2028-02'&&x.id==='c2');
  assert.equal(a.fromDebt,0);assert.equal(a.fromFood,3500);assert.equal(b.pending,3500);assert.equal(b.send,'2028-02-11');
  assert.equal(model.byDate.get(b.send).events.find(e=>e.type==='card').value,3500);assert.equal(model.byDate.get(b.send).minimum,6000);
  assert.equal(model.byDate.get('2028-02-29').events.find(e=>e.type==='bill').value,26000);
  assert.equal(model.months[1].extra,10000);
});
test('un cero confirmado y un mínimo ausente producen estados distintos',()=>{
  const p=sample();p.cards[0].minimum=null;p.cards[1].minimum=0;
  const m=compute(validate(p));assert.deepEqual(m.months[1].statements.map(x=>x.status),['Confirmar mínimo','Sin mínimo']);assert.equal(m.months[1].extra,0);
  assert.equal(m.months[2].statements[1].minimum,null);
});
test('un cobro corregido a cero se conserva y el ajuste semanal solo cambia el escenario',()=>{
  const p=sample();p.weeks[1].override=0;const m=compute(validate(p));
  assert.equal(m.weeks[1].income,0);assert.equal(m.last.scenario-m.last.cash,p.weeks.length*p.settings.saving);
});
test('el respaldo rechaza fechas rotas, dinero negativo y un doble crédito de comida',()=>{
  const p=sample();p.statements['2028-02/c1']={paid:100,foodPaid:200};assert.throws(()=>validate(p));
  p.statements={};p.settings.floor=-1;assert.throws(()=>validate(p));p.settings.floor=0;p.weeks[0].date='2028-02-31';assert.throws(()=>validate(p));
});

function payment(overrides={}){
  return {id:'p1',card:'c2',period:'2028-02',date:'2028-02-08',amount:2500,source:'debt',status:'sent',...overrides};
}
test('un abono parcial desplaza la salida a su fecha y acreditarlo solo cambia el estado',()=>{
  const p=sample(),base=compute(p);
  p.payments=[payment()];
  const sent=compute(validate(p));
  const statement=m=>m.months[1].statements.find(s=>s.id==='c2');
  assert.equal(statement(sent).remaining,3500);
  assert.equal(statement(sent).paid,0);
  assert.equal(statement(sent).transit,2500);
  assert.equal(sent.byDate.get('2028-02-08').out-base.byDate.get('2028-02-08').out,2500);
  assert.equal(sent.byDate.get('2028-02-11').out-base.byDate.get('2028-02-11').out,-2500);
  assert.equal(sent.last.cash,base.last.cash);
  p.payments[0].status='credited';
  const credited=compute(validate(JSON.parse(JSON.stringify(p))));
  assert.equal(statement(credited).paid,2500);
  assert.equal(statement(credited).transit,0);
  assert.equal(statement(credited).remaining,3500);
  assert.deepEqual(credited.days.map(d=>d.cash),sent.days.map(d=>d.cash));
});
test('varios abonos y un acreditado previo cubren el mínimo y sustituyen el extra previsto',()=>{
  const p=sample();p.statements['2028-02/c2']={paid:1000};
  const base=compute(p);
  p.payments=[payment({amount:5000,status:'credited'}),payment({id:'p2',amount:8000,date:'2028-02-10'})];
  const m=compute(validate(p)),a=m.months[1].statements[1];
  assert.equal(a.remaining,0);assert.equal(a.paid,6000);assert.equal(a.transit,8000);
  assert.equal(m.byDate.get('2028-02-11').minimum,1000);
  assert.equal(m.months[1].extra,base.months[1].extra-8000);
  assert.equal(m.last.cash,base.last.cash);
});
test('un envío desde comida usa el sobre una sola vez y respeta el mes efectivo de salida',()=>{
  const p=sample(),base=compute(p);
  p.payments=[payment({card:'c1',source:'food',date:'2028-01-28',amount:3500})];
  const model=compute(validate(p)),a=model.months[1].statements[0];
  assert.equal(a.remaining,0);assert.equal(a.transit,3500);
  assert.equal(model.byDate.get('2028-01-28').events.find(e=>e.tab==='payment').value,3500);
  // The initial month has no grocery allocation in this fixture.
  assert.equal(model.last.cash,base.last.cash-3500);
  p.payments[0].date='2028-02-09';
  assert.equal(compute(validate(p)).last.cash,base.last.cash);
});
test('el mes inicial admite abonos sin mínimo y una fecha de envío única por registro',()=>{
  const p=sample();p.payments=[payment({period:'2028-01',date:'2028-01-22'})];
  const m=compute(validate(p));assert.equal(m.months[0].statements[0].remaining,null);
  assert.equal(m.byDate.get('2028-01-22').out,2500);
  for(const invalid of [{date:'2028-01-01'},{amount:0},{status:'maybe'},{card:'missing'},{period:'2029-01'}]){
    assert.throws(()=>validate({...p,payments:[payment(invalid)]}));
  }
  assert.throws(()=>validate({...p,payments:[payment(),payment()]}));
});
