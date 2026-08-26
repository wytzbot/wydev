import {Folder,FileCode,ChevronRight,ChevronDown} from "lucide-react";
import {useState} from "react";

function buildTree(files){
  const root={children:new Map(),files:[]};
  for(const path of Object.keys(files)){
    const parts=path.split("/").filter(Boolean); let node=root;
    parts.forEach((part,i)=>{
      const isFile=i===parts.length-1;
      if(isFile) node.files.push({name:part,path});
      else { if(!node.children.has(part)) node.children.set(part,{children:new Map(),files:[]}); node=node.children.get(part); }
    });
  }
  return root;
}
function Node({node,onOpen,prefix="",depth=0}){
  const [open,setOpen]=useState(depth<1);
  return <div>
    {[...node.children.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([name,child])=>{
      const path=prefix+name;
      return <div key={path}>
        <button className="treeItem folder" style={{paddingLeft:12+depth*14}} onClick={()=>setOpen(v=>!v)}>
          {open?<ChevronDown size={15}/>:<ChevronRight size={15}/>}<Folder size={16}/><span>{name}</span>
        </button>
        {open&&<Node node={child} onOpen={onOpen} prefix={path+"/"} depth={depth+1}/>} 
      </div>;
    })}
    {node.files.sort((a,b)=>a.name.localeCompare(b.name)).map(f=><button className="treeItem" style={{paddingLeft:26+depth*14}} key={f.path} onClick={()=>onOpen(f.path)}><FileCode size={16}/><span>{f.name}</span></button>)}
  </div>;
}
export default function FileExplorer({files,onOpen}){return <div className="tree"><Node node={buildTree(files)} onOpen={onOpen}/></div>}
