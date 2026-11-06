// Verify data binding, date filtering, empty/error states and snapshot reconciliation.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const data=JSON.parse(fs.readFileSync(path.join(root,'data.json'),'utf8'));
const elements=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],{textContent:'',innerHTML:'',value:'',hidden:false,style:{},classList:{toggle(){}},setAttribute(){}}]));
let fail=false;
const context=vm.createContext({console,Intl,Date,Map,Number,String,Object,Array,Blob,setTimeout,URL,Chart:class{constructor(el,config){assert.ok(el);this.config=config;}destroy(){}},document:{getElementById(id){assert.ok(elements.has(id),'Missing DOM id '+id);return elements.get(id);},querySelectorAll(){return[];}},fetch:async()=>{if(fail)throw Error('offline');return{ok:true,json:async()=>structuredClone(data)}}});
const run=code=>vm.runInContext(code,context);
const get=id=>elements.get(id).textContent;
const expected={central:['kv-tot','47.351'],backlog:['bk-tot','1.055'],auditoria:['ts-total','891'],vendas:['vendas-total','48.359'],analitico:['analitico-total','351.659']};
(async()=>{
 vm.runInContext(fs.readFileSync(path.join(root,'app.js'),'utf8'),context);
 await new Promise(setImmediate);
 for(const[key,[id,total]]of Object.entries(expected)){
  const ds=data.datasets[key];
  assert.equal(ds.rows.reduce((s,r)=>s+r.at(-3),0),ds.count);
  assert.equal(Object.values(ds.statuses).reduce((a,b)=>a+b,0),ds.count);
  assert.ok(Math.abs(ds.rows.reduce((s,r)=>s+r.at(-2),0)-ds.sum1)<.05);
  run(`activeTab='${key}';render()`);assert.equal(get(id),total);
  elements.get('dt-from').value='2026-01-01';elements.get('dt-to').value='2026-01-31';run('render()');
  const jan=ds.rows.filter(r=>r[0]>='2026-01-01'&&r[0]<='2026-01-31').reduce((s,r)=>s+r.at(-3),0);
  assert.equal(get(id),jan.toLocaleString('pt-BR'));
  elements.get('dt-from').value='2099-01-01';elements.get('dt-to').value='2099-01-31';run('render()');assert.equal(get(id),'0');assert.equal(elements.get('empty-state').hidden,false);
  run('clearFilter()');assert.equal(get(id),total);
 }
 run("activeTab='backlog';render()");assert.equal(get('bk-rst'),'R$ 663.572,70');assert.equal(get('re-tot'),'395');assert.equal(get('aud-tot'),'487');assert.equal(get('pv-tot'),'173');
 run("activeTab='auditoria';render()");assert.equal(get('ts-done'),'876');assert.equal(get('ts-open'),'15');
 elements.get('dt-from').value='2026-11-06';elements.get('dt-to').value='2026-01-01';run('render()');assert.match(get('filter-error'),/data inicial/);
 fail=true;await run('loadData()');assert.equal(elements.get('load-error').hidden,false);assert.equal(get('ts-total'),'891');
 // Workbook failures preserve the current dataset; successful imports replace all five views.
 run('clearFilter()');let importMode='error';
 const replacement=structuredClone(data);replacement.origin='local';replacement.source='Updated.xlsx';
 for(const ds of Object.values(replacement.datasets)){ds.rows=[structuredClone(ds.rows[0])];ds.rows[0][ds.rows[0].length-3]=2;ds.count=2;}
 context.Worker=class{postMessage(){if(importMode==='pending')return;this.onmessage({data:importMode==='error'?{type:'error',message:'Aba obrigatória não encontrada.'}:{type:'complete',snapshot:structuredClone(replacement)}});}terminate(){}};
 await run("importWorkbook({name:'invalid.xlsx'})");assert.equal(get('ts-total'),'891');assert.match(get('import-status'),/anteriores foram mantidos/);
 importMode='success';await run("importWorkbook({name:'Updated.xlsx'})");
 for(const [key,[id]]of Object.entries(expected)){run(`activeTab='${key}';render()`);assert.equal(get(id),'2',key+' import binding');}
 assert.equal(elements.get('import-workbook').disabled,false);
 importMode='pending';const cancelled=run("importWorkbook({name:'Cancel.xlsx'})");run('cancelWorkbookImport()');await cancelled;assert.match(get('import-status'),/Leitura cancelada/);assert.equal(get('analitico-total'),'2');
 assert.ok(!html.includes('URL_GAS')&&!html.includes('DEMO'));
 const publicJson=JSON.stringify(data);for(const token of ['CpfProspect','IdCasal','ChaveProposta','PROSPECT'])assert.ok(!publicJson.includes(token),'Unexpected personal column '+token);
 console.log('PASS: source totals, amount reconciliation, date filters, empty/reset/error states, atomic five-tab workbook import, cancellation, and public aggregate schema.');
})().catch(e=>{console.error(e);process.exit(1)});
