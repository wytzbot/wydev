export const ext=p=>p.split(".").pop()?.toLowerCase()||"";
export const languageFor=p=>({js:"javascript",jsx:"javascript",ts:"javascript",tsx:"javascript",json:"json",md:"markdown",py:"python",css:"css",html:"html"}[ext(p)]||"text");
export const copy=async text=>navigator.clipboard?.writeText(text);

// Copies text via the Clipboard + Blob APIs (as opposed to plain writeText)
// so larger, richly-formatted diagnosis reports copy reliably as a discrete
// text/plain payload. Falls back to writeText for browsers without
// ClipboardItem support.
export const copyBlob=async text=>{
  const blob=new Blob([text],{type:"text/plain"});
  if(navigator.clipboard?.write&&typeof ClipboardItem!=="undefined"){
    await navigator.clipboard.write([new ClipboardItem({[blob.type]:blob})]);
    return;
  }
  await navigator.clipboard?.writeText(text);
};

// "now" / "N mins ago" / "N hrs ago" / "N days ago" ... for file/folder last-modified display.
export function relativeTime(ts){
  if(!ts) return "";
  const diff=Math.max(0,Date.now()-ts);
  const sec=Math.floor(diff/1000);
  if(sec<60) return "now";
  const min=Math.floor(sec/60);
  if(min<60) return `${min} min${min===1?"":"s"} ago`;
  const hr=Math.floor(min/60);
  if(hr<24) return `${hr} hr${hr===1?"":"s"} ago`;
  const day=Math.floor(hr/24);
  if(day<30) return `${day} day${day===1?"":"s"} ago`;
  const mo=Math.floor(day/30);
  if(mo<12) return `${mo} mo${mo===1?"":"s"} ago`;
  const yr=Math.floor(mo/12);
  return `${yr} yr${yr===1?"":"s"} ago`;
}
