"""Importa las entradas del formato Calendario y pagos por tarjeta. Solo escribe en .local."""
from datetime import date
from decimal import Decimal
from pathlib import Path
import argparse
import json
from openpyxl import load_workbook

parser = argparse.ArgumentParser()
parser.add_argument('archivo', type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
dest = root / '.local' / 'plan.json'
if dest.exists():
    raise SystemExit('Ya existe un plan local. Conserva su respaldo antes de importar otro archivo.')
w = load_workbook(args.archivo, data_only=True)
formulas = load_workbook(args.archivo, data_only=False)
def cents(n):
    return None if n is None else int((Decimal(str(n))*100).quantize(Decimal('1')))
def get(sheet, cell):
    return w[sheet][cell].value
def day(d):
    return d.date().isoformat() if d else None

months=[day(get('Plan mensual',f'A{r}'))[:7] for r in range(8,16)]
setting_keys=['opening','income','rent','bills','food','goal','decTarget','target','floor','firstBills','firstFood','firstRent']
settings={key:cents(get('Presupuesto',f'B{r}')) for r,key in enumerate(setting_keys,6)}
settings['firstDebt']=cents(get('Plan mensual','F8'))
settings['saving']=cents(get('Mi semana','B45'))
plan=dict(version=1,start=day(get('Cada viernes','A8')),end=day(get('Gastos fijos','J26')),settings=settings,
          foodCard='c1',cards=[], bills=[], weeks=[], statements={}, priorities={})
# El día 1 siguiente es el cierre exclusivo del periodo ordinario, con pago de renta incluido.
for r in range(7,14):
    name,bal,apr,mn,due=[c.value for c in w['Tarjetas'][r]][:5]
    plan['cards'].append(dict(id=f'c{r-6}',name=name,balance=cents(bal),apr=None if apr is None else int(round(apr*10000)),minimum=cents(mn),dueDay=due))
for r in range(7,17):
    row=[c.value for c in w['Gastos fijos'][r]]
    plan['bills'].append(dict(id=f'b{r-6}',name=row[0],day=row[1],amounts={m:cents(x) for m,x in zip(months,row[2:10])}))
for r in range(8,40):
    row=[c.value for c in w['Cada viernes'][r]]
    plan['weeks'].append(dict(date=day(row[0]),base=None if formulas['Cada viernes'][f'C{r}'].data_type=='f' else cents(row[2]),override=cents(row[3]),billsOverride=cents(row[12])))
for r in range(8,57):
    ix=r-8
    row=[c.value for c in w['Vencimientos'][r]]
    plan['statements'][f'{months[1+ix//7]}/c{1+ix%7}']=dict(minimum=cents(row[2]) if ix>=7 else None,
      dueDate=day(row[3]) if ix>=7 else None, paid=cents(row[5]),interest=cents(row[7]),balance=cents(row[8]),
      foodCredit=cents(row[10]),foodPaid=cents(get('Envíos por tarjeta',f'I{r}')))
for i,m in enumerate(months):
    name=get('Envíos por tarjeta',f'B{64+i}')
    cid=next((c['id'] for c in plan['cards'] if c['name']==name),None)
    override=None if formulas['Envíos por tarjeta'][f'F{64+i}'].data_type=='f' else cents(get('Envíos por tarjeta',f'F{64+i}'))
    plan['priorities'][m]=dict(card=cid,cap=override)
dest.parent.mkdir(exist_ok=True)
with dest.open('x',encoding='utf-8') as f:
    json.dump(plan,f,ensure_ascii=False)
print('Plan importado a la carpeta privada local.')
