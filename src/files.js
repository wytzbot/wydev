export const readFileText=async(file)=>file.text();
export const folderEntries=async(handle,prefix="")=>{const out=[];for await(const [name,h] of handle.entries()){const path=prefix+name;if(h.kind==="file")out.push({path,file:h});else out.push(...await folderEntries(h,path+"/"))}return out};
export const shouldSkip=p=>/(^|\/)(node_modules|\.git|dist|build)(\/|$)/.test(String(p))||/\.map$/.test(String(p));
export function safeRepoPath(input=""){
  const p=String(input).replaceAll("\\","/").replace(/^\/+/,"");
  const parts=p.split("/").filter(Boolean);
  if(parts.some(x=>x===".."||x===".")) throw new Error("Invalid repository path.");
  return parts.join("/");
}
export function shouldSkipUpload(pathname=""){
  const p=safeRepoPath(pathname);
  return p.split("/").some(x=>[".git","node_modules",".next","dist","build","coverage"].includes(x))
    || /\.(log|tmp|swp)$/i.test(p);
}
export function normalizeUploadEntry(relativePath,file){
  const path=safeRepoPath(relativePath);
  if(!path || shouldSkipUpload(path)) return null;
  const max=10*1024*1024;
  if(file?.size>max) throw new Error(`File too large: ${path}`);
  return {path,file};
}
