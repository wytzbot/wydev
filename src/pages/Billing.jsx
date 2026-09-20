import Select from "../components/Select";
import {useEffect,useRef,useState} from "react";
import {billing} from "../billing";
import {confirmDialog} from "../dialog";

function b64(bytes){let s="";bytes.forEach(x=>s+=String.fromCharCode(x));return btoa(s)}
function nonce(){const a=crypto.getRandomValues(new Uint8Array(12));return Array.from(a).map(x=>String.fromCharCode(65+(x%26))).join("")}
async function keyBytes(key){if(!key)throw new Error("FLW_ENCRYPTION_KEY is not configured");const raw=Uint8Array.from(atob(key),c=>c.charCodeAt(0));if(raw.length!==32)throw new Error("Flutterwave encryption key must decode to 32 bytes");return raw}
async function encryptField(value,keyBytes,ns){const k=await crypto.subtle.importKey("raw",keyBytes,{name:"AES-GCM"},false,["encrypt"]);const out=await crypto.subtle.encrypt({name:"AES-GCM",iv:new TextEncoder().encode(ns)},k,new TextEncoder().encode(String(value)));return b64(new Uint8Array(out))}
async function encryptCard(card,key){const raw=await keyBytes(key),ns=nonce();return {nonce:ns,encrypted_card_number:await encryptField(card.number,raw,ns),encrypted_expiry_month:await encryptField(card.month,raw,ns),encrypted_expiry_year:await encryptField(card.year,raw,ns),encrypted_cvv:await encryptField(card.cvv,raw,ns)}}


export default function Billing(){
 const [status,setStatus]=useState({plan:"free"}),[cfg,setCfg]=useState({usd:7,ngn:7500,encryptionKey:""}),[currency,setCurrency]=useState("NGN"),[busy,setBusy]=useState(false),[err,setErr]=useState(""),[card,setCard]=useState({number:"",expiry:"",cvv:""}),[billingInfo,setBillingInfo]=useState({name:"",email:""}),[auth,setAuth]=useState(null),[authValue,setAuthValue]=useState(""),[authFields,setAuthFields]=useState({}),[authMessage,setAuthMessage]=useState(""),[success,setSuccess]=useState(false),[cancelling,setCancelling]=useState(false),[cancelled,setCancelled]=useState(false);
 const pollRef=useRef(null);
 const pollTimeoutRef=useRef(null);
 const pendingRef=useRef("");
 const checkingRef=useRef(false);

 const showSuccess=()=>{
   pendingRef.current="";
   try{localStorage.removeItem("wydev:pendingPayment")}catch{}
   setStatus(s=>({...s,plan:"pro"}));
   setAuth(null);setAuthValue("");setAuthFields({});setAuthMessage("");setErr("");setSuccess(true);
 };
 const stopPolling=()=>{
   if(pollRef.current){clearInterval(pollRef.current);pollRef.current=null}
   if(pollTimeoutRef.current){clearTimeout(pollTimeoutRef.current);pollTimeoutRef.current=null}
 };
 const checkReference=async(reference)=>{
   if(!reference||checkingRef.current)return false;
   checkingRef.current=true;
   try{
     try{
       const v=await billing.resolve({reference});
       if(v.active){showSuccess();return true}
     }catch{}
     try{
       const v=await billing.recover(reference);
       if(v.active){showSuccess();return true}
     }catch{}
     return false;
   }finally{
     checkingRef.current=false;
   }
 };
 const startPolling=reference=>{
   if(!reference)return;
   pendingRef.current=reference;
   stopPolling();
   checkReference(reference);
   pollRef.current=setInterval(async()=>{if(await checkReference(reference))stopPolling()},3000);
   pollTimeoutRef.current=setTimeout(stopPolling,90000);
 };

 useEffect(()=>{
   (async()=>{
     try{
       let s=await billing.status();
       if(s.plan!=="pro"){try{s=await billing.recover(localStorage.getItem("wydev:pendingPayment")||"")}catch{} }
       setStatus(s);
       if(s.plan==="pro")setSuccess(false);
     }catch(e){setErr(e?.message||"Failed to load billing status.")}
   })();
   billing.config().then(setCfg).catch(()=>{});
   const params=new URLSearchParams(location.search),ref=params.get("tx_ref")||params.get("reference")||"";
   let saved="";try{saved=localStorage.getItem("wydev:pendingPayment")||""}catch{}
   const initial=ref||saved;
   if(initial){try{localStorage.setItem("wydev:pendingPayment",initial)}catch{};startPolling(initial)}
   return stopPolling;
 },[]);

 const verify=async(id,reference)=>{
   const v=await billing.verify({id,reference});
   if(v.active){showSuccess();return true}
   const terminal=["failed","cancelled","canceled","voided"].includes(String(v.status||"").toLowerCase());
   if(terminal){stopPolling();setErr(v.message||"Payment did not complete. No Pro access was granted.");return false}
   startPolling(reference);
   setErr("Payment is still processing. Complete the bank authorization and WyteLab will activate Pro automatically.");
   return false;
 };
 const redirectFrom=data=>data?.next_action?.redirect_url?.url||data?.next_action?.redirect_url||data?.authurl||data?.auth_url||data?.meta?.authorization?.redirect||data?.meta?.authorization?.url||data?.data?.next_action?.redirect_url?.url||data?.data?.next_action?.redirect_url||null;
 const describeAuth=(data)=>{
   const next=data?.data?.next_action||data?.next_action||{};
   const authorization=next?.authorization||data?.data?.authorization||data?.authorization||{};
   const actionType=String(next?.type||data?.data?.authmodel||data?.authmodel||data?.meta?.authorization?.mode||"").toLowerCase();
   const authType=String(authorization?.type||next?.authorization?.type||data?.data?.authmodel||data?.authmodel||data?.meta?.authorization?.type||"").toLowerCase();
   const type=authType||actionType;
   const msg=String(data?.message||data?.data?.message||data?.data?.processor_response?.message||data?.data?.issuer_response?.message||"");
   const pin=next?.requires_pin||authorization?.pin||null;
   const otp=next?.requires_otp||authorization?.otp||null;
   const redirect=redirectFrom(data);
   if(actionType.includes("redirect")||redirect)return {kind:"redirect",type:"redirect_url",message:msg};
   if(actionType.includes("additional")||next?.requires_additional_fields)return {kind:"fields",type:"requires_additional_fields",fields:next?.requires_additional_fields?.fields||[],message:msg};
   if(authType.includes("pin")||pin||actionType.includes("pin"))return {kind:"pin",type:"requires_pin",nonce:pin?.nonce||null,message:msg};
   if(authType.includes("otp")||authType.includes("password")||authType.includes("passcode")||authType.includes("soft_token")||otp||actionType.includes("otp")||actionType.includes("password")||actionType.includes("passcode")||/\b(otp|one[- ]time|password|passcode|soft[- ]token|verification code)\b/i.test(msg))return {kind:"otp",type:"requires_otp",message:msg};
   if(actionType==="authorize"&&authorization&&Object.keys(authorization).length===0)return {kind:"otp",type:"requires_otp",message:msg||"Enter the password or OTP sent by your bank."};
   if(type||msg)return {kind:"unknown",type:type||"authorization",message:msg};
   return null;
 };
 const handleChargeResponse=async(d,reference)=>{
   const data=d?.data||{};
   const ref=data.reference||reference;
   if(String(data.status||d?.status||"").toLowerCase()==="succeeded"&&data.id){return await verify(data.id,ref)}
   if(["failed","cancelled","canceled"].includes(String(data.status||"").toLowerCase())){setErr(data.message||data.processor_response?.message||"Flutterwave declined the payment.");return false}
   if(ref){pendingRef.current=ref;try{localStorage.setItem("wydev:pendingPayment",ref)}catch{}}
   const redirect=redirectFrom(data)||redirectFrom(d);
   if(redirect){location.href=redirect;return true}
   const a=describeAuth(d);
   if(a?.kind==="redirect"){const u=redirectFrom(d);if(u){location.href=u;return true}}
   if(data.id&&a){setAuth({id:data.id,reference:ref,type:a.type,kind:a.kind,nonce:a.nonce||null,fields:a.fields||[],redirect:redirect||null});setAuthMessage(a.message||"");return true}
   if(data.id)return await verify(data.id,ref);
   if(ref)startPolling(ref);
   return false;
 };
 const pay=async()=>{setBusy(true);setErr("");try{const name=billingInfo.name.trim();if(!name)throw new Error("Enter the cardholder's full name.");const email=billingInfo.email.trim();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error("Enter a valid email address.");const [month,year]=card.expiry.split("/");if(!/^\d{1,2}$/.test(month)||!/^(\d{2}|\d{4})$/.test(year)||card.number.length<12||card.cvv.length<3)throw new Error("Enter a valid card number, MM/YY and CVV.");const enc=await encryptCard({number:card.number,month,year:year.length===4?year.slice(-2):year,cvv:card.cvv},cfg.encryptionKey);const d=await billing.checkout({currency,name,email,payment_method:{type:"card",card:enc}});await handleChargeResponse(d)}catch(e){setErr(e?.message||"Flutterwave payment failed. Check the payment details and your v4 credentials.")}finally{setBusy(false)}};
 const authorize=async()=>{setBusy(true);setErr("");try{if(auth.kind!=="fields"&&!authValue.trim())throw new Error("Enter the verification value sent by your bank.");let authorization;if(auth.kind==="pin"||auth.type==="requires_pin"){const raw=await keyBytes(cfg.encryptionKey),ns=auth.nonce||nonce();authorization={type:"pin",pin:{nonce:ns,encrypted_pin:await encryptField(authValue.trim(),raw,ns)}}}else if(auth.kind==="otp"||auth.type==="requires_otp"){authorization={type:"otp",otp:{code:authValue.trim()}}}else if(auth.kind==="fields"){const avs={address:{city:authFields.city||"",country:authFields.country||"",line1:authFields.line1||"",line2:authFields.line2||"",postal_code:authFields.postal_code||"",state:authFields.state||""}};authorization={type:"avs",avs};}else if(auth.kind==="redirect"){const u=auth.redirect||redirectFrom(auth);if(u){location.href=u;return}throw new Error("Flutterwave did not provide an authorization URL.");}else throw new Error("Flutterwave returned an unsupported authorization method. Please retry the payment so the required bank verification can be requested again.");const d=await billing.authorize({id:auth.id,reference:auth.reference,authorization});setAuth(null);setAuthValue("");setAuthFields({});setAuthMessage("");const ok=await handleChargeResponse(d,auth.reference);if(!ok)startPolling(auth.reference)}catch(e){setErr(e.message)}finally{setBusy(false)}};
 const authLabel=auth?.kind==="pin"?"Card PIN":auth?.kind==="fields"?"Billing address":(auth?.kind==="otp"?"Password / OTP":"Bank verification");
 const authPlaceholder=auth?.kind==="pin"?"Enter card PIN":auth?.kind==="otp"?"Enter the password or OTP sent by your bank":"Enter verification value";
 const cancelSubscription=async()=>{
   const ok=await confirmDialog({title:"Cancel Pro subscription",message:"This stops future billing and immediately removes Pro access. This can't be undone — you'll need to pay again to restore Pro.",confirmLabel:"Cancel subscription",danger:true});
   if(!ok)return;
   setCancelling(true);setErr("");
   try{
     await billing.cancel();
     setStatus(s=>({...s,plan:"free",expiresAt:null,renewAt:null,renewalPending:false}));
     setSuccess(false);setCancelled(true);
   }catch(e){setErr(e?.message||"Failed to cancel subscription.")}
   finally{setCancelling(false)}
 };
 if(status.plan==="pro")return <div className="page"><header><div><span className="eyebrow">BILLING</span><h1>WyteLab Pro</h1></div></header><section className="panel"><h3>PLAN</h3><p className="proActiveBadge"><b>YOU ARE ON THE PRO PLAN</b></p><p className="muted">{status.expiresAt?`Next renewal: ${new Date(status.expiresAt).toLocaleDateString()}.`:""} Monthly recurring subscription. Payment confirmations are verified server-side before Pro access is granted. For your security, no payment or card details are ever displayed here.</p>{success&&<p className="successText">Payment successful. Pro is active.</p>}<button className="cancelSubBtn" disabled={cancelling} onClick={cancelSubscription}>{cancelling?"Cancelling…":"Cancel subscription"}</button>{err&&<p className="error">{err}</p>}</section></div>;
 return <div className="page"><header><div><span className="eyebrow">BILLING</span><h1>WyteLab Pro</h1></div></header><section className="panel proOffer"><h3>PRO INCLUDES</h3><ul className="featureList"><li><b>More GitHub repositories</b><span>Remove the free repository limit and keep more repositories in your WyteLab workspace.</span></li><li><b>5 AI diagnoses/day</b><span>Get a higher daily AI diagnosis allowance; answers stay concise.</span></li><li><b>Revert repository</b><span>Restore a branch to an earlier commit without rewriting its Git history.</span></li><li><b>Rerun failed workflows</b><span>Retry failed GitHub Actions jobs directly from WyteLab, including optional debug logging.</span></li></ul><p className="muted">Your Pro benefits are tied to your WyteLab account and remain available while your subscription is active.</p></section><section className="panel"><h3>PLAN</h3>{cancelled&&<p className="muted">Your Pro subscription has been cancelled.</p>}<div className="price">{currency==="NGN"?(cfg.ngn?`₦${cfg.ngn.toLocaleString()}`:"NGN price not configured"):`$${(cfg.usd??1).toFixed(2)}`}/month · recurring</div><Select value={currency} onChange={setCurrency} options={[{value:"NGN",label:"NGN — ₦"},{value:"USD",label:"USD — $"}]} />{!auth?<><input className="searchInput" type="text" autoComplete="name" placeholder="Full name" value={billingInfo.name} onChange={e=>setBillingInfo({...billingInfo,name:e.target.value})}/><input className="searchInput" type="email" autoComplete="email" placeholder="Email" value={billingInfo.email} onChange={e=>setBillingInfo({...billingInfo,email:e.target.value})}/><input className="searchInput" inputMode="numeric" autoComplete="cc-number" placeholder="Card number" value={card.number} onChange={e=>setCard({...card,number:e.target.value.replace(/\D/g,"")})}/><input className="searchInput" inputMode="numeric" autoComplete="cc-exp" placeholder="MM/YY" maxLength={5} value={card.expiry} onChange={e=>{const digits=e.target.value.replace(/\D/g,"").slice(0,4);setCard({...card,expiry:digits.length>2?`${digits.slice(0,2)}/${digits.slice(2)}`:digits})}}/><input className="searchInput" inputMode="numeric" autoComplete="cc-csc" placeholder="CVV" value={card.cvv} onChange={e=>setCard({...card,cvv:e.target.value.replace(/\D/g,"")})}/><button className="primary" disabled={busy} onClick={pay}>{busy?"Processing…":"Pay securely with Flutterwave"}</button></>:<div className="authBox"><p><b>{authLabel}</b></p>{authMessage&&<p className="muted">{authMessage}</p>}{auth.kind==="fields"?auth.fields.map(f=>{const key=String(f).split(".").pop();return <input key={key} className="searchInput" placeholder={key.replace(/_/g," ")} value={authFields[key]||""} onChange={e=>setAuthFields({...authFields,[key]:e.target.value})}/> }):<input className="searchInput" type={auth.kind==="otp"?"text":"password"} inputMode={auth.kind==="pin"||auth.kind==="otp"?"numeric":"text"} autoComplete={auth.kind==="otp"?"one-time-code":"off"} placeholder={authPlaceholder} value={authValue} onChange={e=>setAuthValue(e.target.value)}/>}<button className="primary" disabled={busy} onClick={authorize}>{busy?"Authorizing…":"Continue payment"}</button><button className="ghost" type="button" disabled={busy} onClick={()=>{setAuth(null);setAuthValue("");setAuthMessage("")}}>Cancel</button></div>}<p className="muted">Card fields are encrypted in your browser with AES-256 before WyteLab sends payment data to Flutterwave. Your card data is sent only to the payment API and is not stored by WyteLab. WyteLab does not store your card PIN, password or OTP.</p>{err&&<p className="error">{err}</p>}</section></div>
}
