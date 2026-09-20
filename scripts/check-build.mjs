import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const root=process.cwd();
const required=[
  "index.html","package.json","vite.config.js",".env.example",
  "api/index.js","src/main.jsx","src/App.jsx","src/github.js",
  "src/ai.js","src/billing.js","src/storage.js","src/files.js",
  "src/git.js","src/styles.css","src/pages/Billing.jsx","src/pages/Project.jsx","vercel.json"
];
const missing=required.filter(x=>!fs.existsSync(path.join(root,x)));
if(missing.length){console.error("Missing:",missing);process.exit(1)}

execFileSync(process.execPath,["--check","api/index.js"],{stdio:"inherit"});

// node --check only validates plain JS (api/index.js). It CANNOT parse JSX, so a
// syntax error anywhere under src/**.jsx would previously pass this script silently
// and only surface as a broken production build. Actually parse every src file with
// esbuild (a transitive dependency of vite, present once `npm install` has run) so a
// build-breaking syntax error fails this script instead of shipping.
{
  let esbuildPath;
  try{ esbuildPath=require.resolve("esbuild/lib/main.js",{paths:[root]}); }catch{}
  if(!esbuildPath){
    try{ esbuildPath=require.resolve("vite/node_modules/esbuild/lib/main.js",{paths:[root]}); }catch{}
  }
  if(!esbuildPath){
    console.warn("esbuild not found (run npm install first) — skipping JSX/JS syntax check. This does NOT mean the build is clean.");
  } else {
    const esbuild = require(esbuildPath);
    const jsxFiles=[];
    (function walkSrc(dir){
      for(const name of fs.readdirSync(dir)){
        if(["node_modules","dist",".git"].includes(name)) continue;
        const p=path.join(dir,name), st=fs.statSync(p);
        if(st.isDirectory()) walkSrc(p);
        else if(/\.(js|jsx)$/.test(name)) jsxFiles.push(p);
      }
    })(path.join(root,"src"));
    const failures=[];
    for(const f of jsxFiles){
      try{ esbuild.transformSync(fs.readFileSync(f,"utf8"),{loader:f.endsWith(".jsx")?"jsx":"js",jsx:"automatic"}); }
      catch(e){ failures.push(`${path.relative(root,f)}: ${e.message.split("\n")[0]}`); }
    }
    if(failures.length){ console.error("JSX/JS syntax check FAILED:\n"+failures.join("\n")); process.exit(1); }
    console.log(`JSX/JS syntax check: PASS (${jsxFiles.length} files parsed)`);
  }
}

// esbuild only validates syntax — it happily transforms `import {Issue} from
// "lucide-react"` even though lucide-react has never exported an icon named
// "Issue". That exact typo (GitHubHub.jsx meant the "CircleDot" icon) passed
// this script and every prior check clean, then broke the real Vercel/Rollup
// build with "'Issue' is not exported by lucide-react". Cross-check every
// `import {...} from "lucide-react"` in src/ against the actual named exports
// of the installed package so a nonexistent icon name fails here instead of
// failing production deploys.
{
  let lucideEntry;
  try{ lucideEntry=require.resolve("lucide-react",{paths:[root]}); }catch{}
  if(!lucideEntry){
    console.warn("lucide-react not found (run npm install first) — skipping icon-export check. This does NOT mean every icon import is valid.");
  } else {
    const { pathToFileURL } = await import("url");
    const lucideModule = await import(pathToFileURL(lucideEntry).href);
    const exported = new Set(Object.keys(lucideModule));
    const srcFiles=[];
    (function walkSrc(dir){
      for(const name of fs.readdirSync(dir)){
        if(["node_modules","dist",".git"].includes(name)) continue;
        const p=path.join(dir,name), st=fs.statSync(p);
        if(st.isDirectory()) walkSrc(p);
        else if(/\.(js|jsx)$/.test(name)) srcFiles.push(p);
      }
    })(path.join(root,"src"));
    const missing=[];
    const importRe=/import\s*\{([^}]*)\}\s*from\s*["']lucide-react["']/g;
    for(const f of srcFiles){
      const s=fs.readFileSync(f,"utf8");
      let m;
      while((m=importRe.exec(s))){
        for(const raw of m[1].split(",")){
          const name=raw.trim().split(/\s+as\s+/)[0].trim();
          if(name && !exported.has(name)) missing.push(`${path.relative(root,f)}: "${name}" is not exported by lucide-react`);
        }
      }
    }
    if(missing.length){ console.error("lucide-react icon check FAILED:\n"+missing.join("\n")); process.exit(1); }
    console.log(`lucide-react icon check: PASS (checked against installed package)`);
  }
}

const api=fs.readFileSync(path.join(root,"api/index.js"),"utf8");
const forbidden=[
  /console\.log\([^)]*(token|secret|password|cvv|card)/i,
  /process\.env\.GITHUB_CLIENT_SECRET.*src/i
];
for(const re of forbidden) if(re.test(api)) { console.error("Security check failed:",re); process.exit(1); }

const webhookHandler=api.slice(api.indexOf('"/billing/webhook"'), api.indexOf('"/billing/renew"'));
if(/memory\.transactions\.get/.test(webhookHandler)) throw new Error("Webhook handler reads the in-memory transaction map directly instead of the durable getTransaction() helper — this breaks across serverless cold starts/instances even when Firestore is configured.");
if(!/await getTransaction\(/.test(webhookHandler)) throw new Error("Webhook handler must look up the transaction via the durable getTransaction() helper");

if(/tree:\s*EMPTY_TREE_SHA|:\s*"4b825dc642cb6eb9a060e54bf8d69288fbee4904"/.test(api)) throw new Error("Commit endpoint references Git's well-known empty-tree SHA directly instead of creating it via POST /git/trees first — GitHub 404s on objects that were never actually created in this specific repo, even ones with a universal content hash.");

const app=fs.readFileSync(path.join(root,"src/App.jsx"),"utf8");
const billing=fs.readFileSync(path.join(root,"src/pages/Billing.jsx"),"utf8");
if(!/github\s*\.\s*session\s*\(\)/.test(app)) throw new Error("Auth session check missing");
const menu=fs.readFileSync(path.join(root,"src/components/Menu.jsx"),"utf8");
if(/<Mail\b/.test(menu) && !/\bMail\b/.test(menu.split("\n")[1]||"")) throw new Error("Menu uses Mail but does not import it");
if(!billing.includes('billing.checkout')) throw new Error("Billing checkout action missing");
if(!api.includes('/billing/webhook')) throw new Error("Flutterwave webhook route missing");
if(!api.includes('expectedSha')) throw new Error("Remote-change protection missing");
if(!api.includes('getEntitlement')) throw new Error("Persistent entitlement layer missing");
if(!api.includes('getUsage')) throw new Error("Persistent AI usage layer missing");
if(!api.includes('incrementUsage(s.id,quota.day,quota.limit)')) throw new Error("Atomic AI quota enforcement missing");
if(!api.includes('gemini-3.8-flash') || !api.includes('gemini-3.7-flash') || !api.includes('gemini-3.5-flash-lite')) throw new Error("Active Gemini fallback chain missing");
if(api.includes('OPENAI_API_KEY') || api.includes('AI_ENDPOINT_1')) throw new Error("OpenAI-compatible AI fallback must not be present");
if(!fs.readFileSync(path.join(root,"src/pages/Billing.jsx"),"utf8").includes("5 AI diagnoses/day")) throw new Error("Pro AI plan text is not 5/day");
if(!fs.readFileSync(path.join(root,"src/pages/Actions.jsx"),"utf8").includes("../components/Select")) throw new Error("Actions page still uses a native picker");

console.log("WyteLab source checks passed.");
console.log("GitHub OAuth: present");
console.log("GitHub commit/push + remote SHA guard: present");
console.log("AI diagnostic + quota + fallback: present");
console.log("Firebase persistence layer: present");
console.log("Flutterwave v4 + webhook + verification: present");

const sourceFiles=[];
function walk(dir){
  for(const name of fs.readdirSync(dir)){
    if(["node_modules","dist",".git"].includes(name)) continue;
    const p=path.join(dir,name), st=fs.statSync(p);
    if(st.isDirectory()) walk(p); else sourceFiles.push(p);
  }
}
walk(path.join(root,"src"));
for(const p of sourceFiles){
  const s=fs.readFileSync(p,"utf8");
  if(/GITHUB_CLIENT_SECRET|FLW_CLIENT_SECRET|OPENAI_API_KEY|FIREBASE_PRIVATE_KEY/.test(s))
    throw new Error(`Server secret reference found in frontend source: ${path.relative(root,p)}`);
}
console.log("Frontend secret-scan: PASS");
