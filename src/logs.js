const KEY="wydev:diagnosisLogs";
const MAX=30;
export function getLogs(){try{const v=JSON.parse(localStorage.getItem(KEY)||"[]");return Array.isArray(v)?v.slice(0,MAX):[]}catch{return []}}
export function addLog(log){const item={id:`log_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,createdAt:new Date().toISOString(),...log};try{localStorage.setItem(KEY,JSON.stringify([item,...getLogs()].slice(0,MAX)))}catch{}return item}
export function clearLogs(){try{localStorage.removeItem(KEY)}catch{}}
export function formatLog(log){return `[${new Date(log.createdAt).toLocaleString()}] ${log.type||"Log"}\n${log.repo?`Repo: ${log.repo}\n`:""}${log.branch?`Branch: ${log.branch}\n`:""}${log.text||""}`}
function escPdf(s){return String(s).replace(/[^\x20-\x7E]/g,"?").replace(/\\/g,"\\\\").replace(/\(/g,"\\(").replace(/\)/g,"\\)")}
export function downloadText(logs,filename="wydev-logs.txt"){
 const text=logs.map(formatLog).join("\n\n---\n\n");
 downloadBlob(new Blob([text],{type:"text/plain;charset=utf-8"}),filename)
}
export function downloadPdf(logs,filename="wydev-logs.pdf"){
 const lines=[];
 logs.forEach((x,i)=>{formatLog(x).split(/\r?\n/).forEach(l=>lines.push(l));if(i<logs.length-1)lines.push("---")});
 const perPage=48,pages=[];for(let i=0;i<lines.length;i+=perPage)pages.push(lines.slice(i,i+perPage));
 if(!pages.length)pages.push(["WyteLab Logs"]);
 const objs=[];const add=o=>{objs.push(o);return objs.length};
 const font=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');const contentIds=[];
 pages.forEach(pg=>{let y=770,stream="BT\n/F1 9 Tf\n";pg.forEach(line=>{stream+=`1 0 0 1 40 ${y} Tm (${escPdf(line.slice(0,120))}) Tj\n`;y-=15});stream+="ET";const streamBytes=new TextEncoder().encode(stream);contentIds.push(add(`<< /Length ${streamBytes.byteLength} >>\nstream\n${stream}endstream`))});
 const pageIds=[];pages.forEach((_,i)=>pageIds.push(add(`<< /Type /Page /Parent PAGES /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${contentIds[i]} 0 R >>`)));
 const pagesId=add(`<< /Type /Pages /Kids [${pageIds.map(x=>x+' 0 R').join(' ')}] /Count ${pageIds.length} >>`);const catalogId=add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
 for(let i=0;i<objs.length;i++)objs[i]=objs[i].replace(/PAGES/g,`${pagesId} 0 R`);
 const enc=new TextEncoder();let pdf="%PDF-1.4\n",offs=[0];objs.forEach((o,i)=>{offs.push(enc.encode(pdf).byteLength);pdf+=`${i+1} 0 obj\n${o}\nendobj\n`});const x=enc.encode(pdf).byteLength;pdf+=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`;for(let i=1;i<offs.length;i++)pdf+=String(offs[i]).padStart(10,"0")+" 00000 n \n";pdf+=`trailer\n<< /Size ${objs.length+1} /Root ${catalogId} 0 R >>\nstartxref\n${x}\n%%EOF`;downloadBlob(new Blob([pdf],{type:"application/pdf"}),filename)
}
function downloadBlob(blob,filename){const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
