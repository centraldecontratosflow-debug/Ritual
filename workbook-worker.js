'use strict';
// Read locally in a worker. Only grouped dashboard data is returned to the page.
importScripts('./vendor/xlsx.mini.min.js');
const normalize=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const clean=v=>v==null||String(v).trim()===''||String(v).trim()==='-'?'Não informado':String(v).trim();
const numeric=v=>typeof v==='number'&&Number.isFinite(v)?v:0;
const definitions=[
  {key:'backlog',names:['Dados_Backlog','Backlog'],id:'SOLICITAÇÃO',date:'DATA DA SOLICITAÇÃO',fields:['SOLICITAÇÃO','STATUS','DATA DA SOLICITAÇÃO','SALA DE VENDA','INCONSISTÊNCIA','RESTITUÍDO','VGV']},
  {key:'central',names:['Dados_Central','Central'],id:'PROPOSTA',date:'DATAPROP',fields:['PROPOSTA','DATAPROP','SALAVENDAS','STATUSPROP','PENDENCIA','VALORVENDA']},
  {key:'auditoria',names:['Dados_Auditoria TS','Auditoria TS'],id:'Proposta',date:'DATA',fields:['Proposta','DATA','SalaVendas','AUDITORIA','RESPONS','ValorVenda']},
  {key:'vendas',names:['Dados_Vendas','Vendas'],id:'Proposta',date:'DataProp',fields:['Proposta','DataProp','SalaVendas','StatusProp','Empreendimento','ValorVenda']},
  {key:'analitico',names:['Analítico de Vendas','Analitico de Vendas'],id:'ChaveProposta',date:'DataProp',fields:['ChaveProposta','DataProp','SalaVendas','StatusProp','Empreendimento','ValorVenda']}
];
function day(v,date1904){
  if(typeof v==='number'){
    const d=XLSX.SSF.parse_date_code(v,{date1904});
    return d&&d.y>=1900&&d.y<=2100?`${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`:'';
  }
  if(v instanceof Date&&!Number.isNaN(+v))return v.toISOString().slice(0,10);
  const s=String(v??'').trim();let m=s.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
  if(!m){const br=s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);if(br)m=[br[0],br[3],br[2],br[1]];}
  if(!m)return '';
  const iso=`${m[1]}-${m[2]}-${m[3]}`,d=new Date(iso+'T00:00:00Z');
  return !Number.isNaN(+d)&&d.toISOString().slice(0,10)===iso?iso:'';
}
function locateHeader(sheet,def){
  const rows=sheet['!data']||[];
  for(let r=0;r<Math.min(rows.length,20);r++){
    const cols=new Map();(rows[r]||[]).forEach((c,i)=>{if(c?.v!=null)cols.set(normalize(c.v),i);});
    if(def.fields.every(f=>cols.has(normalize(f))))return {row:r,cols};
  }
  throw Error(`A aba “${def.sheet}” não tem as colunas esperadas: ${def.fields.join(', ')}.`);
}
function aggregateSheet(sheet,def,date1904){
  const header=locateHeader(sheet,def),rows=sheet['!data']||[],groups=new Map(),ids=new Map(),statuses=Object.create(null);
  let count=0,missingDate=0,start=null,end=null,sum1=0,sum2=0;
  const get=(row,field)=>row[header.cols.get(normalize(field))]?.v;
  for(let i=header.row+1;i<rows.length;i++){
    const row=rows[i];if(!row)continue;
    const id=get(row,def.id);if(id==null||String(id).trim()==='')continue;
    count++;
    if(def.key!=='backlog')ids.set(String(id),(ids.get(String(id))||0)+1);
    const date=day(get(row,def.date),date1904);if(!date)missingDate++;else{if(!start||date<start)start=date;if(!end||date>end)end=date;}
    let dims,a=0,b=0,status;
    if(def.key==='backlog'){
      status=({concluido:'Concluído',emandamento:'Em Andamento',apagar:'A Pagar',adesignar:'A Designar'})[normalize(get(row,'STATUS'))]||clean(get(row,'STATUS'));
      const type=({erros:'Erros',posvendas:'Pós Vendas',reembolsoestorno:'Reembolso / Estorno'})[normalize(get(row,'SOLICITAÇÃO'))]||clean(get(row,'SOLICITAÇÃO'));
      dims=[date,clean(get(row,'SALA DE VENDA')),status,type,clean(get(row,'INCONSISTÊNCIA'))];a=numeric(get(row,'RESTITUÍDO'));b=numeric(get(row,'VGV'));
    }else if(def.key==='central'){
      status=clean(get(row,'STATUSPROP'));dims=[date,clean(get(row,'SALAVENDAS')),status,clean(get(row,'PENDENCIA'))];a=numeric(get(row,'VALORVENDA'));
    }else if(def.key==='auditoria'){
      const value=get(row,'AUDITORIA');status=normalize(value)==='auditado'?'Auditado':clean(value)==='Não informado'?'Pendente':clean(value);
      dims=[date,clean(get(row,'SalaVendas')),status,clean(get(row,'RESPONS'))];a=numeric(get(row,'ValorVenda'));
    }else{
      status=clean(get(row,'StatusProp'));dims=[date,clean(get(row,'SalaVendas')),status,clean(get(row,'Empreendimento'))];a=numeric(get(row,'ValorVenda'));
    }
    statuses[status]=(statuses[status]||0)+1;sum1+=a;sum2+=b;
    const key=JSON.stringify(dims),g=groups.get(key);if(g){g[g.length-3]++;g[g.length-2]+=a;g[g.length-1]+=b;}else groups.set(key,[...dims,1,a,b]);
  }
  const resultRows=Array.from(groups.values());for(const row of resultRows){row[row.length-2]=Math.round(row[row.length-2]*100)/100;row[row.length-1]=Math.round(row[row.length-1]*100)/100;}
  if(resultRows.reduce((s,r)=>s+r[r.length-3],0)!==count)throw Error('Falha ao conferir os totais da aba '+def.sheet);
  return {sheet:def.sheet,dateColumn:def.date,count,missingDate,duplicateIds:def.key==='backlog'?null:Array.from(ids.values()).reduce((s,n)=>s+Math.max(0,n-1),0),start,end,statuses,sum1:Math.round(sum1*100)/100,sum2:Math.round(sum2*100)/100,rows:resultRows};
}
self.onmessage=async({data})=>{
  try{
    const file=data.file;
    postMessage({type:'progress',message:'Abrindo a planilha…'});
    const buffer=await file.arrayBuffer();
    const names=XLSX.read(buffer,{type:'array',bookSheets:true}).SheetNames;
    const selected=definitions.map(def=>{
      const matches=names.filter(name=>def.names.some(alias=>normalize(name)===normalize(alias)));
      if(matches.length!==1)throw Error(matches.length?`Mais de uma aba corresponde a ${def.names[0]}.`:`Aba obrigatória não encontrada: ${def.names[0]}.`);
      return {...def,sheet:matches[0]};
    });
    postMessage({type:'progress',message:'Lendo as cinco abas. Arquivos grandes podem levar alguns instantes…'});
    const wb=XLSX.read(buffer,{type:'array',dense:true,sheets:selected.map(d=>d.sheet),cellFormula:false,cellHTML:false,cellText:false,cellStyles:false,cellDates:false});
    const snapshot={source:file.name,importedAt:new Date().toISOString(),origin:'local',datasets:{}};
    for(const def of selected){
      postMessage({type:'progress',message:'Atualizando '+def.sheet+'…'});
      snapshot.datasets[def.key]=aggregateSheet(wb.Sheets[def.sheet],def,!!wb.Workbook?.WBProps?.date1904);
      delete wb.Sheets[def.sheet];
    }
    postMessage({type:'complete',snapshot});
  }catch(e){postMessage({type:'error',message:e?.message||'Não foi possível ler a planilha.'});}
};
