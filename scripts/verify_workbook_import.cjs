// Exercise the actual browser worker parser against the original workbook.
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const XLSX=require(path.join(root,'vendor/xlsx.mini.min.js'));
const baseline=JSON.parse(fs.readFileSync(path.join(root,'data.json'),'utf8'));
let result,error;
const context={XLSX,Date,console,importScripts(){},postMessage(message){if(message.type==='complete')result=message.snapshot;else if(message.type==='error')error=message.message;else console.log(message.message);}};
context.self=context;
vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(root,'workbook-worker.js'),'utf8'),context);
(async()=>{
 const bytes=fs.readFileSync(process.argv[2]);
 await context.onmessage({data:{file:{name:path.basename(process.argv[2]),arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)}}});
 assert.ok(!error,error);assert.ok(result);
 for(const [key,ds]of Object.entries(baseline.datasets)){
  const actual=result.datasets[key];
  for(const field of ['count','missingDate','duplicateIds','start','end'])assert.equal(actual[field],ds[field],key+' '+field);
  for(const field of ['sum1','sum2'])assert.ok(Math.abs(actual[field]-ds[field])<.02,key+' '+field);
  assert.deepEqual(JSON.parse(JSON.stringify(actual.statuses)),ds.statuses,key+' status counts');
  const expected=new Map(ds.rows.map(r=>[JSON.stringify(r.slice(0,-3)),r.slice(-3)]));
  assert.equal(actual.rows.length,expected.size,key+' group count');
  for(const row of actual.rows){const want=expected.get(JSON.stringify(row.slice(0,-3)));assert.ok(want,key+' group');assert.equal(row.at(-3),want[0]);assert.ok(Math.abs(row.at(-2)-want[1])<.02);assert.ok(Math.abs(row.at(-1)-want[2])<.02);}
  console.log('PASS',key,actual.count,'source records;',actual.rows.length,'groups');
 }
 // A file missing required tabs is rejected atomically.
 result=null;error=null;
 const invalid=Buffer.from('Other\nValue');
 await context.onmessage({data:{file:{name:'invalid.xlsx',arrayBuffer:async()=>invalid.buffer.slice(invalid.byteOffset,invalid.byteOffset+invalid.byteLength)}}});
 assert.match(error,/Aba obrigatória/);assert.equal(result,null);
 console.log('PASS: missing-tab rejection; all five workbook aggregates match the published baseline.');
})().catch(e=>{console.error(e);process.exitCode=1;});
