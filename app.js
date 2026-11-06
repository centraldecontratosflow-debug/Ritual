'use strict';
let snapshot=null;
let activeTab='central';
let filtered=[];
const CH={};
let importTask=null;
const labels={central:'Central de Contratos',backlog:'Backlog',auditoria:'Auditoria TS',vendas:'Vendas',analitico:'Analítico de Vendas'};
const N=n=>Number(n||0).toLocaleString('pt-BR');
const R=n=>Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:2});
const P=(a,b)=>b?((a/b)*100).toLocaleString('pt-BR',{maximumFractionDigits:1})+'%':'—';
const axisMoney=n=>'R$ '+Number(n).toLocaleString('pt-BR',{notation:'compact',maximumFractionDigits:1});
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sum=(rs,col)=>rs.reduce((n,r)=>n+r[col],0);
const count=rs=>sum(rs,rs.length?rs[0].length-3:4);
const amount=rs=>sum(rs,rs.length?rs[0].length-2:5);
function group(rs,col,valueCol=null){
  const out=Object.create(null);
  for(const r of rs){const key=typeof col==='function'?col(r):r[col];out[key]=(out[key]||0)+(valueCol===null?r[r.length-3]:r[valueCol]);}
  return out;
}
function sorted(obj){return Object.entries(obj).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'pt-BR'));}
function val(id,v){document.getElementById(id).textContent=v;}
function chart(id,obj,type='bar',currency=false){
  if(CH[id]){CH[id].destroy();delete CH[id];}
  const entries=type==='line'?Object.entries(obj).sort((a,b)=>a[0].localeCompare(b[0])):sorted(obj);
  const el=document.getElementById(id);
  if(typeof Chart==='undefined'){el.parentElement.textContent='Gráfico indisponível. Consulte os totais na tabela.';return;}
  CH[id]=new Chart(el,{type:type==='donut'?'doughnut':type,data:{labels:entries.map(e=>e[0]),datasets:[{label:currency?'VGV vendido':'Registros',data:entries.map(e=>e[1]),backgroundColor:type==='donut'?['#0B306B','#A57A4C','#2e7d32','#e65100','#1565c0','#6a1b9a','#667085']:'#0B306B',borderColor:'#A57A4C',borderWidth:type==='line'?2:0,borderRadius:type==='bar'?4:0,tension:0,pointRadius:2}]},options:{responsive:true,maintainAspectRatio:false,animation:false,...(type==='bar'?{indexAxis:'y'}:{}),...(type==='donut'?{cutout:'60%'}:{}),plugins:{legend:{display:type==='donut',position:'bottom'},tooltip:{callbacks:{label:c=>`${c.dataset.label}: ${currency?R(c.raw):N(c.raw)}`}}},...(type==='donut'?{}:{scales:{x:{beginAtZero:true,ticks:{maxRotation:0,...(type==='bar'&&currency?{callback:axisMoney}:{})}},y:{beginAtZero:true,ticks:{...(type==='bar'?{}:{callback:v=>currency?axisMoney(v):N(v)})}}}})}});
}
function topEntries(obj){return Object.fromEntries(sorted(obj).slice(0,10));}
function summaryTable(id,obj,heading='Sala de vendas',currency=false){
  const pairs=sorted(obj);
  document.getElementById(id).innerHTML=pairs.length?`<table><thead><tr><th>${esc(heading)}</th><th>${currency?'VGV vendido':'Registros'}</th></tr></thead><tbody>${pairs.map(([k,v])=>`<tr><td>${esc(k)}</td><td>${currency?R(v):N(v)}</td></tr>`).join('')}</tbody></table>`:'<p class="empty">Sem registros no período selecionado.</p>';
}
function pendingList(id,rs,status){
  const pairs=sorted(group(rs.filter(r=>r[3]===status),1));
  document.getElementById(id).innerHTML=pairs.length?pairs.map(([s,n])=>`<div class="pi"><span class="pi-name">${esc(s)}</span><span class="pi-sala"> · ${N(n)} proposta(s)</span></div>`).join(''):'<div class="pi-empty">Nenhuma pendência</div>';
}
function renderCentral(rs){
  const statuses=group(rs,2),pending=group(rs,3),total=count(rs);
  val('kv-tot',N(total));val('kv-vnd',N(statuses.Vendida));val('kv-con',N(statuses.Confirmada));val('kv-tx',P(statuses.Vendida||0,total));
  ['Aprovado','Aprovar','Backlog','Assinatura'].forEach((p,i)=>val('pv-ap'+i,N(pending[p])));
  pendingList('pl-aprovar',rs,'Aprovar');pendingList('pl-backlog',rs,'Backlog');pendingList('pl-assinatura',rs,'Assinatura');
  chart('ch-sala-c',topEntries(group(rs,1)));chart('ch-status',statuses,'donut');chart('ch-pend',pending,'donut');
  summaryTable('central-detail',group(rs,1));
}
function renderBacklog(rs){
  const statuses=group(rs,2),total=count(rs);
  val('bk-tot',N(total));val('bk-rst',R(sum(rs,6)));val('bk-vgv',R(sum(rs,7)));val('bk-tx',P(statuses['Concluído']||0,total));
  for(const [prefix,type] of [['aud','Erros'],['pv','Pós Vendas'],['re','Reembolso / Estorno']]){
    const subset=rs.filter(r=>r[3]===type),st=group(subset,2),n=count(subset);
    val(prefix+'-tot',N(n));val(prefix+'-sub',N(n)+' registros');
    val(prefix+'-con',N(st['Concluído']));val(prefix+'-and',N(st['Em Andamento']));
    val(prefix+(prefix==='re'?'-pag':'-des'),N(st[prefix==='re'?'A Pagar':'A Designar']));
    if(prefix==='re'){val('re-rst',R(sum(subset,6)));val('re-vgv',R(sum(subset,7)));}
    if(prefix==='pv'){
      const entries=sorted(group(subset,4));
      document.getElementById('pv-incons').innerHTML=entries.length?entries.map(([k,v])=>`<div class="incons-item"><span class="incons-key">${esc(k)}</span><span class="incons-cnt">${N(v)}</span></div>`).join(''):'<div class="pi-empty">Sem inconsistências no período</div>';
    }
  }
  chart('ch-sala-b',topEntries(group(rs,1)));chart('ch-tipo',group(rs,3),'donut');summaryTable('backlog-detail',group(rs,1));
}
function renderAudit(rs){
  const st=group(rs,2),total=count(rs);
  val('ts-total',N(total));val('ts-done',N(st.Auditado));val('ts-open',N(st.Pendente));val('ts-rate',P(st.Auditado||0,total));
  chart('ts-room',topEntries(group(rs,1)));chart('ts-status',st,'donut');
  chart('ts-month',group(rs,r=>r[0].slice(0,7)||'Sem data'),'line');
  summaryTable('auditoria-detail',group(rs,3),'Responsável');
}
function renderSales(rs,key){
  const sold=rs.filter(r=>r[2]==='Vendida'),st=group(rs,2);
  val(key+'-total',N(count(rs)));val(key+'-sold',N(count(sold)));val(key+'-vgv',R(amount(sold)));val(key+'-ticket',count(sold)?R(amount(sold)/count(sold)):'—');
  chart(key+'-room',topEntries(group(sold,1,5)),'bar',true);chart(key+'-status',st,'donut');
  chart(key+'-month',group(sold,r=>r[0].slice(0,7)||'Sem data',5),'line',true);
  chart(key+'-project',topEntries(group(sold,3,5)),'bar',true);
  summaryTable(key+'-detail',group(sold,1,5),'Sala de vendas',true);
}
function renderSource(rs){
  const ds=snapshot.datasets[activeTab],from=document.getElementById('dt-from').value,to=document.getElementById('dt-to').value;
  const fmt=d=>d?d.split('-').reverse().join('/'):'—';
  val('scope',`${labels[activeTab]} · ${N(count(rs))} registros · ${from||to?`${fmt(from||ds.start)} a ${fmt(to||ds.end)}`:'Todo o período: '+fmt(ds.start)+' a '+fmt(ds.end)}`);
  val('source-info',`Fonte: ${snapshot.source} → ${ds.sheet}. Data do filtro: ${ds.dateColumn}. Importação: ${new Date(snapshot.importedAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}.`);
  let notes='Contagens por linha preenchida da aba, sem somar bases distintas. Valores em reais. ';
  notes+=snapshot.origin==='local'?'Arquivo importado neste navegador. Esta atualização fica salva apenas neste navegador; a versão publicada para a equipe continua disponível em “Versão publicada”. Fórmulas usam os valores salvos no Excel.':'“Atualizar da planilha” lê um arquivo Excel do computador e recalcula as cinco abas neste navegador.';
  if(activeTab==='central')notes+=' Total de propostas, sem deduplicação de clientes. Percentual vendido = Vendidas ÷ Total de propostas; a base contém apenas Vendida e Confirmada.';
  if(activeTab==='backlog')notes+=' Tipos e status normalizados apenas por grafia. Restituído e VGV são somas das respectivas colunas; A pagar é um status de tratativa.';
  if(activeTab==='auditoria')notes+=` Há ${N(ds.duplicateIds)} ocorrências adicionais de números de proposta repetidos na aba; os indicadores representam registros de auditoria, sem inferir clientes únicos. Campo AUDITORIA vazio = Pendente.`;
  if(activeTab==='vendas'||activeTab==='analitico')notes+=' VGV e ticket consideram somente status Vendida. Data da proposta define o período. As abas Vendas e Analítico têm coberturas diferentes e são exibidas separadamente.';
  if(ds.missingDate)notes+=` ${N(ds.missingDate)} registros sem data aparecem apenas sem filtro de período.`;
  if(ds.duplicateIds&&activeTab==='analitico')notes+=` A aba contém ${N(ds.duplicateIds)} ocorrências adicionais de ChaveProposta repetida; o painel preserva as linhas da fonte.`;
  val('source-notes',notes);
  const empty=count(rs)===0;document.getElementById('empty-state').hidden=!empty;
}
function render(){
  if(!snapshot)return;
  const from=document.getElementById('dt-from').value,to=document.getElementById('dt-to').value;
  if(from&&to&&from>to){val('filter-error','A data inicial deve ser anterior ou igual à data final.');return;}
  val('filter-error','');
  filtered=snapshot.datasets[activeTab].rows.filter(r=>(!from&&!to)||(r[0]&&(!from||r[0]>=from)&&(!to||r[0]<=to)));
  for(const c of Object.values(CH))c.destroy();for(const k of Object.keys(CH))delete CH[k];
  if(activeTab==='central')renderCentral(filtered);else if(activeTab==='backlog')renderBacklog(filtered);else if(activeTab==='auditoria')renderAudit(filtered);else renderSales(filtered,activeTab);
  renderSource(filtered);
}
function applyFilter(){render();}
function clearFilter(){document.getElementById('dt-from').value='';document.getElementById('dt-to').value='';render();}
function setTab(name,btn){
  activeTab=name;document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('active',p.id==='tab-'+name));
  document.querySelectorAll('.tbtn').forEach(b=>{b.classList.toggle('active',b===btn);b.setAttribute('aria-selected',b===btn?'true':'false');});render();
}
function savedSnapshot(action,value){
  return new Promise((resolve,reject)=>{
    if(typeof indexedDB==='undefined'){resolve(null);return;}
    const open=indexedDB.open('ritual-dashboard',1);
    open.onupgradeneeded=()=>{if(!open.result.objectStoreNames.contains('snapshots'))open.result.createObjectStore('snapshots');};
    open.onerror=()=>reject(open.error);open.onblocked=()=>reject(Error('Armazenamento ocupado'));
    open.onsuccess=()=>{
      const db=open.result,tx=db.transaction('snapshots',action==='read'?'readonly':'readwrite'),store=tx.objectStore('snapshots');
      const request=action==='read'?store.get('local'):action==='delete'?store.delete('local'):store.put(value,'local');
      tx.oncomplete=()=>{db.close();resolve(action==='read'?request.result:true);};
      tx.onerror=()=>{db.close();reject(tx.error);};tx.onabort=()=>{db.close();reject(tx.error||Error('Armazenamento indisponível'));};
    };
  });
}
function validSnapshot(data){return data&&Object.keys(labels).every(key=>data.datasets?.[key]&&Array.isArray(data.datasets[key].rows));}
function setSnapshot(data){
  if(!validSnapshot(data))throw Error('Base incompleta');
  snapshot=data;
  val('last-update',(data.origin==='local'?'Arquivo local · ':'Planilha · ')+new Date(data.importedAt).toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'}));
  document.getElementById('load-error').hidden=true;render();
}
function importMessage(message,isError=false){
  const el=document.getElementById('import-status');el.hidden=!message;el.textContent=message;el.classList.toggle('import-error',isError);
}
function busyImport(on){
  document.getElementById('import-workbook').disabled=on;document.getElementById('refresh').disabled=on;
  document.getElementById('cancel-import').hidden=!on;
}
function chooseWorkbook(){document.getElementById('workbook-file').click();}
function cancelWorkbookImport(){
  if(!importTask)return;
  const task=importTask;task.worker.terminate();task.reject(Object.assign(Error('Leitura cancelada.'),{name:'AbortError'}));
}
async function importWorkbook(file){
  if(!file||importTask)return;
  if(!/\.xlsx$/i.test(file.name)){importMessage('Selecione uma planilha no formato .xlsx.',true);return;}
  busyImport(true);importMessage('Preparando a leitura de '+file.name+'…');
  try{
    const data=await new Promise((resolve,reject)=>{
      const worker=new Worker('./workbook-worker.js?v=20261106-1');importTask={worker,reject};
      worker.onmessage=({data})=>{
        if(data.type==='progress')importMessage(data.message);
        else if(data.type==='complete')resolve(data.snapshot);
        else if(data.type==='error')reject(Error(data.message));
      };
      worker.onerror=()=>reject(Error('Não foi possível iniciar a leitura do Excel. Recarregue a página e tente novamente.'));
      worker.postMessage({file});
    });
    if(!validSnapshot(data))throw Error('O arquivo não contém as cinco bases completas.');
    let stored=false;try{stored=await savedSnapshot('write',data);}catch{}
    setSnapshot(data);
    importMessage(`${file.name}: cinco abas atualizadas. ${stored?'Os dados ficam salvos neste navegador.':'A atualização vale enquanto esta página estiver aberta.'} Para usar uma nova versão do Excel, selecione o arquivo novamente. A versão pública da equipe não é alterada.`);
  }catch(e){
    importMessage(e.name==='AbortError'?'Leitura cancelada. Os dados anteriores foram mantidos.':e.message+' Os dados anteriores foram mantidos.',e.name!=='AbortError');
  }finally{importTask?.worker.terminate();importTask=null;busyImport(false);}
}
async function loadData(forcePublished=false){
  const button=document.getElementById('refresh');button.disabled=true;document.getElementById('import-workbook').disabled=true;document.getElementById('loading-bar').style.display='flex';
  try{
    if(!forcePublished){
      let saved=null;try{saved=await savedSnapshot('read');}catch{}
      if(validSnapshot(saved)){setSnapshot(saved);importMessage('Exibindo '+saved.source+', importada e salva neste navegador. Selecione o Excel novamente para ler alterações recentes.');return;}
    }
    const res=await fetch('./data.json',{cache:'no-store'});if(!res.ok)throw Error('Falha ao carregar a planilha publicada');
    const data=await res.json();if(!validSnapshot(data))throw Error('Base incompleta');
    if(forcePublished){try{await savedSnapshot('delete');importMessage('Exibindo a versão publicada para a equipe.');}catch{importMessage('Versão publicada carregada. Não foi possível remover a cópia salva neste navegador.',true);}}
    setSnapshot(data);
  }catch(e){const el=document.getElementById('load-error');el.hidden=false;el.textContent='Não foi possível carregar os dados. Tente Atualizar novamente.';if(!snapshot)val('last-update','Dados indisponíveis');}
  finally{button.disabled=false;document.getElementById('import-workbook').disabled=false;document.getElementById('loading-bar').style.display='none';}
}
function exportCsv(){
  if(!snapshot)return;
  const ds=snapshot.datasets[activeTab],header=activeTab==='backlog'?['Data','Sala','Status','Tipo','Inconsistência','Registros','Restituído','VGV']:['Data','Sala','Status',activeTab==='auditoria'?'Responsável':activeTab==='central'?'Pendência':'Empreendimento','Registros','Valor','Reservado'];
  const cell=v=>'"'+String(v??'').replace(/^[=+@-]/,"'$&").replace(/"/g,'""')+'"';
  const blob=new Blob(['\ufeff'+[header,...filtered].map(r=>r.map(cell).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=ds.sheet.replace(/\s/g,'_')+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
loadData();
