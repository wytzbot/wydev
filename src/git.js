// Content can be a plain string (text files) or a {__wydevBinary,base64,...}
// object (binary files). Strings compare fine with ===, but binary payloads
// are rebuilt as new object instances every time state round-trips through
// localStorage (JSON.parse never restores reference identity), so a strict
// === on those objects would mark every previously-viewed binary file as
// changed forever, even when its bytes never changed. Compare by value instead.
const sameContent=(a,b)=>{
  if(a===b) return true;
  const aBin=a&&typeof a==="object"&&a.__wydevBinary===true;
  const bBin=b&&typeof b==="object"&&b.__wydevBinary===true;
  if(aBin&&bBin) return a.base64===b.base64;
  return false;
};
export const buildChangeSet=(base,current)=>{const keys=new Set([...Object.keys(base),...Object.keys(current)]);return [...keys].flatMap(path=>sameContent(base[path],current[path])?[]:[{path,status:!(path in base)?"A":!(path in current)?"D":"M",content:current[path]}])};
export const renameFolder=(files,from,to)=>Object.fromEntries(Object.entries(files).map(([p,v])=>[p===from||p.startsWith(from+"/")?to+p.slice(from.length):p,v]));
