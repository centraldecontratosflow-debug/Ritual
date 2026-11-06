"""Generate public aggregates only. Usage: python scripts/extract_workbook.py workbook.xlsx."""
import collections
import datetime as dt
import hashlib
import json
import pathlib
import sys
import unicodedata
import openpyxl

def text(v):
    return str(v).strip() if v is not None and str(v).strip() not in ('', '-') else 'Não informado'

def norm(v):
    return ''.join(c for c in unicodedata.normalize('NFD', text(v)) if unicodedata.category(c) != 'Mn').casefold()

def date(v):
    if isinstance(v, (dt.date, dt.datetime)):
        return v.strftime('%Y-%m-%d')
    if isinstance(v, (int, float)) and 20000 < v < 80000:
        return (dt.datetime(1899,12,30)+dt.timedelta(days=v)).strftime('%Y-%m-%d')
    return ''

def number(v):
    return float(v) if isinstance(v,(int,float)) else 0

def main():
    path=pathlib.Path(sys.argv[1])
    wb=openpyxl.load_workbook(path,read_only=True,data_only=True)
    configs=[('backlog','Dados_Backlog',3,1,6),('central','Dados_Central',3,1,4),('auditoria','Dados_Auditoria TS',3,1,14),('vendas','Dados_Vendas',2,1,6),('analitico','Analítico de Vendas',1,0,8)]
    result={'source':path.name,'importedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'datasets':{}}
    for key,sheet,header,idcol,datecol in configs:
        groups={}; count=0; missingdate=0; dates=[]; ids=collections.Counter(); statuses=collections.Counter(); sums=[0.,0.]
        for row in wb[sheet].iter_rows(min_row=header+1,values_only=True):
            if row[idcol] is None: continue
            count+=1
            if key!='backlog': ids[str(row[idcol])]+=1
            day=date(row[datecol]); missingdate+=not bool(day)
            if day: dates.append(day)
            if key=='backlog':
                status={'concluido':'Concluído','em andamento':'Em Andamento','a pagar':'A Pagar','a designar':'A Designar'}.get(norm(row[3]),text(row[3]))
                dims=(day,text(row[11]),status,{'erros':'Erros','pos vendas':'Pós Vendas','reembolso | estorno':'Reembolso / Estorno'}.get(norm(row[1]),text(row[1])),text(row[10]))
                values=(number(row[18]),number(row[19]))
            elif key=='central':
                status=text(row[8]); dims=(day,text(row[7]),status,text(row[12])); values=(number(row[10]),0)
            elif key=='auditoria':
                status='Auditado' if norm(row[17])=='auditado' else ('Pendente' if text(row[17])=='Não informado' else text(row[17]))
                dims=(day,text(row[7]),status,text(row[16])); values=(number(row[9]),0)
            else:
                if key=='vendas': sala,status,emp,amount=10,11,9,12
                else: sala,status,emp,amount=12,13,11,14
                status=text(row[status]); dims=(day,text(row[sala]),status,text(row[emp])); values=(number(row[amount]),0)
            statuses[status]+=1
            entry=groups.setdefault(dims,[0,0.,0.]); entry[0]+=1;entry[1]+=values[0];entry[2]+=values[1]
            sums[0]+=values[0];sums[1]+=values[1]
        rows=[list(k)+[v[0],round(v[1],2),round(v[2],2)] for k,v in sorted(groups.items())]
        assert sum(r[-3] for r in rows)==count
        assert abs(sum(r[-2] for r in rows)-sums[0])<.05
        result['datasets'][key]={'sheet':sheet,'dateColumn':wb[sheet].cell(header,datecol+1).value,'count':count,'missingDate':missingdate,'duplicateIds':None if key=='backlog' else sum(v-1 for v in ids.values() if v>1),'start':min(dates) if dates else None,'end':max(dates) if dates else None,'statuses':dict(statuses),'sum1':round(sums[0],2),'sum2':round(sums[1],2),'rows':rows}
        print(key, {k:v for k,v in result['datasets'][key].items() if k!='rows'},'groups',len(rows),flush=True)
    out=pathlib.Path(__file__).resolve().parents[1]/'data.json'
    out.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    print('Wrote aggregate snapshot:',out.stat().st_size,'bytes')

if __name__=='__main__': main()
