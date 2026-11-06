"""Read-only extraction; stdout is the reviewed migration input, never edits Excel."""
import sys, json, hashlib, math
from pathlib import Path
from openpyxl import load_workbook
sys.stdout.reconfigure(encoding='utf-8')
path=Path(sys.argv[1])
book=load_workbook(path,read_only=True,data_only=True)
def text(v):
    return str(int(v)) if isinstance(v,(float,int)) and int(v)==v else str(v).strip()
def number(v):
    if v is None or v=='': return None
    n=float(v)
    if not math.isfinite(n): raise ValueError('Non-finite source number')
    return n
catalog=[];history=[]
for rowno,r in enumerate(book['DISEÑO'].iter_rows(min_row=2,values_only=True),2):
    if r[1] is None or r[2] is None: continue
    catalog.append(dict(numero=text(r[1]),etapa=text(r[2]),norte=number(r[3]),este=number(r[4]),longitud_diseno=number(r[12]),source_row=rowno))
for rowno,r in enumerate(book['AVANCE'].iter_rows(min_row=4,values_only=True),4):
    if r[2] is None or r[3] is None or r[4] is None: continue
    history.append(dict(fecha=r[2].strftime('%Y-%m-%d'),numero=text(r[3]),etapa=text(r[4]),equipo=str(r[5] or ''),paladas=number(r[6]),volumen_cuchara=number(r[7]),volumen=number(r[8]),longitud_perforacion=number(r[9]),longitud=number(r[10]),longitud_diseno=number(r[11]),diametro=number(r[12]),profundidad=number(r[13]),cst=number(r[14]),cota_inicial=number(r[17]),cota_final=number(r[18]),source_row=rowno))
keys={(e['etapa'],e['numero']) for e in catalog}
assert len(keys)==len(catalog),'Duplicate catalog'
assert len({(e['etapa'],e['numero']) for e in history})==len(history),'Duplicate execution'
assert all((e['etapa'],e['numero']) in keys for e in history),'Unknown pile'
assert all(e['norte'] is not None and e['este'] is not None for e in catalog),'Missing coordinates'
print(json.dumps(dict(source=path.name,sha256=hashlib.sha256(path.read_bytes()).hexdigest(),catalog=catalog,history=history),ensure_ascii=False,separators=(',',':')))
