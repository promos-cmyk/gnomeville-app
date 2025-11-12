import React, { useState, useEffect, useRef, useMemo } from "react";

window.GV = window.GV || {};
window.Components = window.Components || {};

/* =======================
 * CONFIG: Subscription API
 * ======================= */
window.GV.SUB_API_BASE = "https://api.gnomeville.app";
window.GV.SUB_API_KEY  = "";
window.GV.subscribeTo = async function(provider,{name,email,phone,emailOpt,smsOpt,role}) {
  try{
    const res = await fetch(`${window.GV.SUB_API_BASE}/subscriptions/${provider}`, {
      method:"POST",
      headers:{"Content-Type":"application/json",...(window.GV.SUB_API_KEY?{"Authorization":"Bearer "+window.GV.SUB_API_KEY}:{})},
      body: JSON.stringify({name,email,phone,emailOpt,smsOpt,source:"gnomeville",role})
    });
    return res.ok;
  }catch(e){ console.warn("Subscription API failed:",provider,e); return false; }
};

/* ---------- Role routing by subdomain ---------- */
window.GV.roleFromHost = function(){
  const h=(location.hostname||"").toLowerCase();
  if(h.startsWith("admin.")) return "admin";
  if(h.startsWith("partners.")) return "partners";
  if(h.startsWith("advertisers.")) return "advertiser";
  return "participant";
};

/* ---------- Data ---------- */
window.GV.GNOMES=[
  {id:1,name:"Surfer",image:"https://raw.githubusercontent.com/promos-cmyk/legendary-octo-broccoli/main/gnomeville-gnomes/surfer-gnome.png"},
  {id:2,name:"Bartender",image:"https://raw.githubusercontent.com/promos-cmyk/legendary-octo-broccoli/main/gnomeville-gnomes/bartender-gnome.png"},
  {id:3,name:"Fisherman",image:"https://raw.githubusercontent.com/promos-cmyk/legendary-octo-broccoli/main/gnomeville-gnomes/fisherman-gnome.png"},
  {id:4,name:"Ninja",image:"https://raw.githubusercontent.com/promos-cmyk/legendary-octo-broccoli/main/ninja-gnome.png"},
  {id:5,name:"Musician",image:"https://raw.githubusercontent.com/promos-cmyk/legendary-octo-broccoli/main/gnomeville-gnomes/musician-gnome.png"},
  {id:6,name:"Lifeguard",image:"https://raw.githubusercontent.com/promos-cmyk/legendary-octo-broccoli/main/gnomeville-gnomes/lifeguard-gnome.png"},
  {id:7,name:"Party",image:"https://raw.githubusercontent.com/promos-cmyk/legendary-octo-broccoli/main/gnomeville-gnomes/party-gnome.png"},
  {id:8,name:"Yoga",image:"https://raw.githubusercontent.com/promos-cmyk/legendary-octo-broccoli/main/gnomeville-gnomes/yoga-gnome.png"},
  {id:9,name:"Firefighter",image:"https://raw.githubusercontent.com/promos-cmyk/legendary-octo-broccoli/main/gnomeville-gnomes/firefighter-gnome.png"},
  {id:10,name:"Tattoo Artist",image:"https://raw.githubusercontent.com/promos-cmyk/legendary-octo-broccoli/main/gnomeville-gnomes/tattoo-gnome.png"}
];
window.GV.GOLDEN_IMG="https://raw.githubusercontent.com/promos-cmyk/legendary-octo-broccoli/main/golden-gnome.png";

/* ---------- Persistent identity & user ---------- */
if(!localStorage.getItem("__deviceId"))
  localStorage.setItem("__deviceId","dv-"+Math.random().toString(36).slice(2,10));
window.GV.DEVICE_ID = localStorage.getItem("__deviceId");
window.GV.USER_KEY  = "__userProfile";
window.GV.loadUser  = ()=>{try{return JSON.parse(localStorage.getItem(window.GV.USER_KEY)||"null")}catch(e){return null}};
window.GV.saveUser  = (u)=>localStorage.setItem(window.GV.USER_KEY,JSON.stringify(u));

/* ---------- Global demo stores ---------- */
if(!window.__partners) window.__partners=[{id:"par-1",name:"Demo Partner",establishment:"Demo Cafe",address:"123 Beach Ave, Clearwater, FL",cardOnFile:true,blocked:false}];
if(!window.__advertisers) window.__advertisers=[{id:"adv-1",name:"Demo Advertiser",cardOnFile:true,blocked:false}];
if(!window.__gnomeAssignments) window.__gnomeAssignments=Object.fromEntries(window.GV.GNOMES.map(g=>[g.id,{partnerId:"par-1",active:true,previousPartnerId:null}]));
if(!window.__charges) window.__charges=[];
if(!window.__scans) window.__scans=[];
if(!window.__partnerBids) window.__partnerBids=[];
if(!window.__partnerHints) window.__partnerHints=[];
if(!window.__goldenScheduled) window.__goldenScheduled=null;
if(!window.__coupons) window.__coupons=[];
if(!window.__uniqueCodes) window.__uniqueCodes={};
if(!window.__unlockedByDevice) window.__unlockedByDevice={};
if(!window.__deviceCouponGrants) window.__deviceCouponGrants={};
if(!window.__walletSubs) window.__walletSubs={};
if(!window.__redemptions) window.__redemptions=[];
if(!window.__cycleId) window.__cycleId=1;
if(!window.__costPerUnlock) window.__costPerUnlock=1;

/* NEW: Trigger image stores */
if(!window.__triggerImages) window.__triggerImages = {};
if(!window.__submittedTriggers) window.__submittedTriggers = [];

/* NEW: Celebration events for partner wins & advertiser unlocks */
if(!window.__partnerCelebrations) window.__partnerCelebrations = [];
if(!window.__advertiserUnlockEvents) window.__advertiserUnlockEvents = [];

/* ---------- Global CSS & Celebration FX ---------- */
const GlobalFX = () => (
  <style>{`
    @keyframes gfloatdance {
      0% { transform: translate(0,0) rotate(0deg) }
      25% { transform: translate(4px,-3px) rotate(2deg) }
      50% { transform: translate(0,-6px) rotate(-2deg) }
      75% { transform: translate(-4px,-3px) rotate(1deg) }
      100% { transform: translate(0,0) rotate(0deg) }
    }
    .float-gnome, .float-gnome-sm { animation: gfloatdance 3.2s ease-in-out infinite; }
    .coin-nug-fall { position: fixed; top: -5vh; pointer-events: none; z-index: 9999; }
    @keyframes fall { to { transform: translateY(110vh) rotate(360deg); opacity: 0.9; } }
    .scan-overlay::after{
      content:''; position:absolute; inset:12%; border:2px solid rgba(255,255,255,.8);
      border-radius:12px; box-shadow: 0 0 0 200vmax rgba(0,0,0,.35) inset;
    }
    
    /* Button press animation */
    button:active:not(:disabled) {
      transform: scale(0.96);
      transition: transform 0.1s ease;
    }
    button {
      transition: transform 0.1s ease, background-color 0.2s ease;
    }
    
    /* Loading bar at top */
    @keyframes loadProgress {
      0% { width: 0%; }
      100% { width: 100%; }
    }
    .loading-bar {
      position: fixed;
      top: 0;
      left: 0;
      height: 3px;
      background: linear-gradient(90deg, #3b82f6, #10b981);
      z-index: 10000;
      animation: loadProgress 0.8s ease-out forwards;
    }
    
    /* Success notification */
    @keyframes slideInRight {
      from { transform: translateX(400px); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOutRight {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(400px); opacity: 0; }
    }
    .success-notification {
      position: fixed;
      top: 20px;
      right: 20px;
      background: #10b981;
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-weight: 600;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10001;
      animation: slideInRight 0.3s ease-out;
    }
    .success-notification.hiding {
      animation: slideOutRight 0.3s ease-out forwards;
    }
    
    /* Pending approval styles */
    .pending-item {
      transition: all 0.3s ease;
    }
    .pending-item.approved {
      opacity: 0;
      transform: scale(0.9);
    }
  `}</style>
);

window.GV.celebrateRain = function(){
  const N=60, symbols=['🪙','🌿','🪙','🌿','🪙'];
  for(let i=0;i<N;i++){
    const el=document.createElement('div');
    el.textContent=symbols[i%symbols.length];
    el.className='coin-nug-fall';
    el.style.left=(Math.random()*100)+'vw';
    el.style.fontSize=(16+Math.random()*22)+'px';
    el.style.animation=`fall ${2+Math.random()*2.5}s linear forwards`;
    document.body.appendChild(el);
    setTimeout(()=>document.body.removeChild(el), 4500);
  }
};

/* ---------- Global action handler with loading + success feedback ---------- */
window.GV.actionState = { loading: false, success: false };
window.GV.actionHandlers = [];

window.GV.performAction = async function(actionFn, successMessage = "Success!") {
  // Show loading
  window.GV.actionState.loading = true;
  window.GV.actionHandlers.forEach(h => h());

  // Simulate minimum loading time for visual feedback
  const minLoadTime = new Promise(resolve => setTimeout(resolve, 400));
  
  try {
    // Execute action
    await actionFn();
    await minLoadTime;
    
    // Show success
    window.GV.actionState.loading = false;
    window.GV.actionState.success = true;
    window.GV.actionState.successMessage = successMessage;
    window.GV.actionHandlers.forEach(h => h());
    
    // Clear success after notification
    setTimeout(() => {
      window.GV.actionState.success = false;
      window.GV.actionHandlers.forEach(h => h());
    }, 2500);
  } catch (e) {
    window.GV.actionState.loading = false;
    window.GV.actionHandlers.forEach(h => h());
    throw e;
  }
};

/* ---------- Celebration Modal Component ---------- */
window.Components.CelebrationModal = function({ gnomeImage, gnomeName, gnomeId, message, onClose }) {
  useEffect(() => {
    window.GV.celebrateRain();
  }, []);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9998]" onClick={onClose}>
      <div className="bg-white rounded-3xl p-8 max-w-md mx-4 text-center shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="mb-4">
          <img src={gnomeImage} alt={gnomeName} className="w-32 h-32 mx-auto float-gnome" />
        </div>
        <h2 className="text-2xl font-black mb-2">🎉 Congratulations!</h2>
        <p className="text-lg mb-4">{message}</p>
        <button 
          onClick={onClose}
          className="rounded-full bg-black text-white px-6 py-2 hover:bg-gray-800"
        >
          Let's Go!
        </button>
      </div>
    </div>
  );
};

/* ---------- Loading Bar Component ---------- */
window.Components.LoadingBar = function() {
  return <div className="loading-bar" />;
};

/* ---------- Success Notification Component ---------- */
window.Components.SuccessNotification = function({ message = "Success!", onClose }) {
  const [hiding, setHiding] = useState(false);

  useEffect(() => {
    const hideTimer = setTimeout(() => {
      setHiding(true);
    }, 2000);

    const removeTimer = setTimeout(() => {
      onClose();
    }, 2300);

    return () => {
      clearTimeout(hideTimer);
      clearTimeout(removeTimer);
    };
  }, [onClose]);

  return (
    <div className={`success-notification ${hiding ? 'hiding' : ''}`}>
      ✓ {message}
    </div>
  );
};

/* ---------- Pending Approvals Component ---------- */
window.Components.PendingApprovals = function({ items, onApprove }) {
  const [approvedIds, setApprovedIds] = useState(new Set());

  function handleApprove(id) {
    setApprovedIds(prev => new Set([...prev, id]));
    setTimeout(() => {
      onApprove(id);
    }, 300);
  }

  if (!items || items.length === 0) return null;

  return (
    <div className="rounded-2xl border p-3 bg-amber-50 border-amber-200 mb-4">
      <h3 className="font-semibold text-sm mb-2 text-amber-900">⏳ Pending Approvals</h3>
      <ul className="space-y-1.5">
        {items.map(item => (
          <li 
            key={item.id} 
            className={`text-xs flex items-center gap-2 pending-item ${approvedIds.has(item.id) ? 'approved' : ''}`}
          >
            {item.approved ? (
              <span className="text-green-600 font-bold">✓</span>
            ) : (
              <span className="text-amber-600">•</span>
            )}
            <span className={item.approved ? 'text-green-700 line-through' : 'text-amber-900'}>
              {item.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

/* ---------- Utils ---------- */
window.GV.fmtMoney=n=>'$'+Number(n||0).toFixed(2);
window.GV.nowMs   =()=>Date.now();
window.GV.thirtyAgo=()=>window.GV.nowMs()-30*24*60*60*1000;

window.GV.addrToLatLng=a=>{
  const base={lat:27.977,lng:-82.832};
  let h=0;for(let i=0;i<a.length;i++)h=(h*31+a.charCodeAt(i))>>>0;
  const latOff=((h%2000)/2000-.5)*.08,lngOff=(((h/2000)%2000)/2000-.5)*.08;
  return{lat:base.lat+latOff,lng:base.lng+lngOff};
};

window.GV.popularity30d=()=>{
  const m=Object.fromEntries(window.GV.GNOMES.map(g=>[g.id,0])); const since=window.GV.thirtyAgo();
  (window.__scans||[]).forEach(s=>{ if(s.ts>=since && m[s.gnomeId]!=null) m[s.gnomeId]+=1; });
  const rows=window.GV.GNOMES.map(g=>({id:g.id,name:g.name,image:g.image,scans:m[g.id]||0,active:!!window.__gnomeAssignments[g.id]?.active}));
  if(rows.every(r=>r.scans===0)){ rows.forEach(r=>r.scans=50+((r.id*31)%200)); }
  return rows;
};

/* ---------- QR helpers ---------- */
window.GV.qrDataFor = (gnomeId)=> `GNOME:${gnomeId}`;
window.GV.qrPngUrl  = (data, size=160)=> `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;
window.GV.qrSvgUrl  = (data, size=180)=> `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&format=svg&data=${encodeURIComponent(data)}`;

window.GV.downloadSvg = async (svgUrl, filename) => {
  try {
    const res = await fetch(svgUrl);
    if (!res.ok) throw new Error("SVG fetch failed");
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(href);
  } catch (e) {
    alert("Failed to download SVG.");
    console.warn(e);
  }
};

/* Simple QR decoder NOTE:
   We're not shipping a heavy QR library; this 'QR scan' flow uses any native scanner
   or the camera modal to grab a QR URL that encodes "GNOME:<id>" via `qrserver.com`.
   If you want in-app QR decoding, drop in a lib (e.g. jsQR) and wire it to the scanner loop. */

/* ---------- Shared UI bits ---------- */
window.Components.ActiveBadge=({active})=>(
  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${active?'bg-green-50 border-green-500':'bg-gray-50'}`}>{active?'Active':'Inactive'}</span>
);

window.Components.PopularityGrid=function({title,showActive}){
  const rows=window.GV.popularity30d(); const max=Math.max(1,...rows.map(r=>r.scans));
  return (
    <div className="rounded-2xl border p-3 bg-white">
      <h3 className="font-semibold text-sm mb-2">{title}</h3>
      <div className="grid md:grid-cols-5 gap-2">
        {rows.map(r=>(
          <div key={r.id} className="rounded-2xl border p-3 bg-white">
            <div className="flex items-center gap-2 mb-2 text-sm font-semibold">
              <img src={r.image} className="w-5 h-5 object-contain" alt=""/>{`#${r.id} ${r.name}`}
              {showActive && <span className="ml-auto"><window.Components.ActiveBadge active={r.active}/></span>}
            </div>
            <div className="text-[11px] text-gray-500 mb-1">Scans (30d)</div>
            <div className="h-2 w-full rounded bg-gray-200">
              <div className="h-2 rounded bg-black" style={{width:`${Math.round((r.scans/Math.max(1,max))*100)}%`}}/>
            </div>
            <div className="text-xs mt-1 font-mono">{r.scans}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ---------- Dismissible Info Cards (remembered via localStorage) ---------- */
window.Components.InfoCard = function({ lsKey, icon="ℹ️", title, children, defaultOpen=true }) {
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem(lsKey) !== "dismissed"; } catch { return defaultOpen; }
  });
  if (!open) return null;
  function dismiss() {
    try { localStorage.setItem(lsKey, "dismissed"); } catch {}
    setOpen(false);
  }
  return (
    <div className="rounded-2xl border p-3 bg-white shadow-sm">
      <div className="flex items-start gap-2">
        <div className="text-xl leading-none">{icon}</div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">{title}</h3>
            <button className="ml-auto rounded border px-2 py-1 text-[11px]" onClick={dismiss}>Dismiss</button>
          </div>
          <div className="mt-2 text-xs text-gray-700">{children}</div>
        </div>
      </div>
    </div>
  );
};

/* ---------- Role-specific "How it works" cards ---------- */
window.Components.ParticipantIntro = function(){
  return (
    <window.Components.InfoCard
      lsKey="__intro_participant_v1"
      icon="🧍"
      title="How Gnomeville Works (Players)"
    >
      <p><strong>Welcome to Gnomeville!</strong></p>
      <ul className="list-disc ml-4 mt-2 space-y-1">
        <li><strong>Find Clues:</strong> Scan QR posters to see fresh hints tied to the latest trigger image.</li>
        <li><strong>Hunt the Gnome:</strong> Go to the location and use <em>Image Unlock</em> mode to scan the correct logo/photo.</li>
        <li><strong>Unlock & Celebrate:</strong> The gnome dances with coins & nugs — your unique coupons land in your Rewards Wallet.</li>
        <li><strong>Redeem:</strong> Add coupons to Apple Wallet. Each code is device-bound and one-time use.</li>
        <li><strong>Team Up:</strong> Enable location sharing to see other players live on the map.</li>
      </ul>
    </window.Components.InfoCard>
  );
};

window.Components.PartnersIntro = function(){
  return (
    <window.Components.InfoCard
      lsKey="__intro_partners_v1"
      icon="🏪"
      title="How It Works (Partners)"
    >
      <ul className="list-disc ml-4 mt-1 space-y-1">
        <li><strong>Profile:</strong> Add establishment name & address.</li>
        <li><strong>Bid:</strong> Compete monthly for gnomes. Highest bid wins (charged once per cycle).</li>
        <li><strong>Trigger Image:</strong> Upload the logo/photo players must scan. Admin approves and links it to your gnome.</li>
        <li><strong>Activate:</strong> Toggle your gnome to "Active" when it's hidden and ready.</li>
        <li><strong>Clues:</strong> Push manual hints anytime to help players.</li>
        <li><strong>Insights:</strong> Check 30-day scan popularity to value your next bids.</li>
      </ul>
    </window.Components.InfoCard>
  );
};

window.Components.AdvertiserIntro = function(){
  return (
    <window.Components.InfoCard
      lsKey="__intro_advertisers_v1"
      icon="💼"
      title="How It Works (Advertisers)"
    >
      <ul className="list-disc ml-4 mt-1 space-y-1">
        <li><strong>Billing:</strong> Add a card once; pay only when a device unlocks your coupon.</li>
        <li><strong>Create:</strong> Write your offer and target a specific gnome, all gnomes, or the Golden Gnome. Set dates/limits as needed.</li>
        <li><strong>Go Live:</strong> Coupons appear when players unlock via image scan (not QR).</li>
        <li><strong>Engage:</strong> Send pushes to users who added your coupon to Apple Wallet.</li>
        <li><strong>Measure:</strong> Track unlocks, spend, and view 30-day popularity per gnome.</li>
      </ul>
    </window.Components.InfoCard>
  );
};

/* ---------- Signup Modal ---------- */
window.Components.SignupModal=function({role,onDone}){
  const [name,setName]=useState(""); const [email,setEmail]=useState(""); const [phone,setPhone]=useState("");
  const [wfEmail,setWfEmail]=useState(true); const [wfSms,setWfSms]=useState(true);
  const [hyEmail,setHyEmail]=useState(true); const [hySms,setHySms]=useState(true);
  const [busy,setBusy]=useState(false); const [err,setErr]=useState("");

  async function submit(){
    setErr("");
    if(!name||!email||!phone){ setErr("Please fill name, email, and phone."); return; }
    setBusy(true);
    const profile={name,email,phone,createdAt:Date.now(),subs:{wf:{email:wfEmail,sms:wfSms},hyve:{email:hyEmail,sms:hySms}},profileComplete:true};
    if(wfEmail||wfSms) await window.GV.subscribeTo("wildflower",{name,email,phone,emailOpt:wfEmail,smsOpt:wfSms,role});
    if(hyEmail||hySms) await window.GV.subscribeTo("hyve",{name,email,phone,emailOpt:hyEmail,smsOpt:hySms,role});
    window.GV.saveUser(profile); setBusy(false); onDone(profile);
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="w-[92vw] max-w-lg rounded-2xl bg-white shadow-xl border p-4">
        <h3 className="text-lg font-semibold">Create your Gnomeville account</h3>
        <p className="text-xs text-gray-600 mt-1">One-time setup. Your details are saved on this device.</p>
        <div className="grid gap-2 mt-3 text-sm">
          <label className="grid gap-1">Full name<input className="border rounded px-2 py-1" value={name} onChange={e=>setName(e.target.value)}/></label>
          <label className="grid gap-1">Email<input className="border rounded px-2 py-1" value={email} onChange={e=>setEmail(e.target.value)}/></label>
          <label className="grid gap-1">Phone<input className="border rounded px-2 py-1" value={phone} onChange={e=>setPhone(e.target.value)}/></label>
        </div>
        <div className="mt-3 rounded border p-3 bg-gray-50">
          <div className="text-xs text-gray-700 mb-1">Subscribe to unlock <strong>additional gnome clues & rewards</strong>:</div>
          <div className="text-xs grid grid-cols-2 gap-2">
            <div className="rounded border p-2">
              <div className="font-semibold text-sm">WildFlower FL</div>
              <label className="flex items-center gap-2 mt-1"><input type="checkbox" checked={wfEmail} onChange={e=>setWfEmail(e.target.checked)}/>Email</label>
              <label className="flex items-center gap-2 mt-1"><input type="checkbox" checked={wfSms} onChange={e=>setWfSms(e.target.checked)}/>SMS</label>
            </div>
            <div className="rounded border p-2">
              <div className="font-semibold text-sm">Hyve Security</div>
              <label className="flex items-center gap-2 mt-1"><input type="checkbox" checked={hyEmail} onChange={e=>setHyEmail(e.target.checked)}/>Email</label>
              <label className="flex items-center gap-2 mt-1"><input type="checkbox" checked={hySms} onChange={e=>setHySms(e.target.checked)}/>SMS</label>
            </div>
          </div>
          <div className="text-[11px] text-gray-500 mt-2">You can unsubscribe any time via provider messages.</div>
        </div>
        {err && <div className="text-xs text-red-600 mt-2">{err}</div>}
        <div className="mt-3 flex items-center justify-end gap-2">
          <button className="px-3 py-1.5 rounded border" onClick={()=>onDone(null)} disabled={busy}>Cancel</button>
          <button className="px-3 py-1.5 rounded bg-black text-white" onClick={submit} disabled={busy}>{busy?"Saving...":"Create Account"}</button>
        </div>
      </div>
    </div>
  );
};

/* ---------- Code & Clue utilities ---------- */
const codeFor=(couponId,gnomeId)=>`WF-${couponId.slice(0,5).toUpperCase()}-${String(gnomeId).padStart(2,'0')}-${window.GV.DEVICE_ID.slice(-4).toUpperCase()}-${btoa(couponId+'|'+window.GV.DEVICE_ID+'|'+gnomeId+'|'+window.__cycleId).replace(/[^A-Z0-9]/gi,'').slice(0,6).toUpperCase()}`;

const riddleForPartner=(p)=>`Seek the hidden emblem at ${p?.establishment||'our host'}, where a familiar mark hides in plain sight — point your camera at the right logo to wake the gnome.`;
const activePartnerHintFor=(gnomeId)=>{
  const now=Date.now();
  const items=(window.__partnerHints||[]).filter(h=>h.gnomeId===gnomeId&&h.expiresAt>now);
  if(!items.length) return null;
  items.sort((a,b)=>b.expiresAt-a.expiresAt);
  return items[0];
};

/* ---------- Perceptual aHash utilities ---------- */
window.GV.aHashFromImageElement = function(imgEl, size=8){
  const c=document.createElement('canvas'); c.width=size; c.height=size;
  const ctx=c.getContext('2d');
  ctx.drawImage(imgEl,0,0,size,size);
  const data=ctx.getImageData(0,0,size,size).data;
  const gray=new Array(size*size);
  let sum=0;
  for(let i=0;i<gray.length;i++){
    const r=data[i*4], g=data[i*4+1], b=data[i*4+2];
    const v=(r*0.299 + g*0.587 + b*0.114)|0;
    gray[i]=v; sum+=v;
  }
  const avg=sum/gray.length;
  let bits=0n;
  for(let i=0;i<gray.length;i++){
    bits = (bits<<1n) | (gray[i]>=avg ? 1n : 0n);
  }
  return bits;
};

window.GV.hamming64 = function(a,b){
  let x=a^b;
  let count=0;
  while(x){ count++; x &= (x-1n); }
  return count;
};

window.GV.aHashFromDataUrl = function(dataUrl){
  return new Promise((resolve,reject)=>{
    const img=new Image();
    img.onload=()=>{ try{ resolve(window.GV.aHashFromImageElement(img)); } catch(e){ reject(e); } };
    img.onerror=reject;
    img.src=dataUrl;
  });
};

/* =============================================================================
   PARTICIPANT COMPONENT
============================================================================= */
function Participant({user}){
  const [found,setFound]=useState([]);
  const [message,setMessage]=useState("");
  const [scanOpen,setScanOpen]=useState(false);
  const [unlocked,setUnlocked]=useState([]);
  const [mapOn,setMapOn]=useState(false);
  const [gender,setGender]=useState("male");
  const [celebrate,setCelebrate]=useState(null); // {gnomeId,name,image}
  const [qrClue, setQrClue] = useState(null); // { gnomeId, name, thumbUrl, clueHtml }
  const [scanMode, setScanMode] = useState('image'); // 'image' | 'qr'

  const videoRef=useRef(null), canvasRef=useRef(null), loopRef=useRef(null), streamRef=useRef(null);
  const mapRef=useRef(null), meMarkerRef=useRef(null);
  const watchIdRef=useRef(null);

  useEffect(()=>{ // load unlocked from memory store
    const arr=(window.__unlockedByDevice[window.GV.DEVICE_ID]||[])
      .map(u=>{
        const c=(window.__coupons||[]).find(x=>x.id===u.couponId);
        return c?{...u,title:c.title,desc:c.desc}:null;
      })
      .filter(Boolean);
    setUnlocked(arr);
  },[]);

  const progressPct=Math.round((found.length/window.GV.GNOMES.length)*100);

  function grantOnScan(gnomeId){
    let granted=0;
    const coupons=(window.__coupons||[]).filter(c=>{
      if(c.blocked) return false;
      const now=Date.now();
      const windowOk=(!c.startAt||now>=c.startAt)&&(!c.endAt||now<=c.endAt);
      const capOk=!(c.scanCap>0 && (c.unlocks||0)>=c.scanCap);
      const active=c.active&&windowOk&&capOk;
      if(!active) return false;
      if(c.target==='all') return true;
      if(c.target==='golden'&&window.__goldenScheduled) return window.__goldenScheduled.gnomeId===gnomeId;
      if(c.target==='one') return c.gnomeId===gnomeId;
      return false;
    });

    for(const c of coupons){
      const key=`${window.__cycleId}|${window.GV.DEVICE_ID}|${c.id}|${gnomeId}`;
      if(window.__deviceCouponGrants[key]) continue;

      if(!c.system){ // advertiser pay-per-unlock
        const adv=(window.__advertisers||[]).find(a=>a.id===c.advertiserId);
        if(!(adv && adv.cardOnFile) || adv.blocked) continue;
        window.__charges.push({
          type:'advertiser',
          advertiserId:adv.id,
          amount:window.__costPerUnlock,
          ts:Date.now(),
          note:`Unlock ${c.title}`,
          deviceId:window.GV.DEVICE_ID,
          gnomeId
        });
        // Create unlock event for advertiser celebration
        window.__advertiserUnlockEvents.push({
          advertiserId: adv.id,
          gnomeId,
          gnomeName: window.GV.GNOMES.find(g => g.id === gnomeId)?.name,
          gnomeImage: window.GV.GNOMES.find(g => g.id === gnomeId)?.image,
          couponTitle: c.title,
          ts: Date.now(),
          claimed: false
        });
      }

      const code=codeFor(c.id,gnomeId);
      window.__uniqueCodes[code]={couponId:c.id,deviceId:window.GV.DEVICE_ID,used:false,gnomeId,cycleId:window.__cycleId};
      c.unlocks=(c.unlocks||0)+1;

      if(!window.__unlockedByDevice[window.GV.DEVICE_ID]) window.__unlockedByDevice[window.GV.DEVICE_ID]=[];
      window.__unlockedByDevice[window.GV.DEVICE_ID].push({couponId:c.id,code,gnomeId});
      window.__deviceCouponGrants[key]=true;
      granted++;
    }

    const arr=(window.__unlockedByDevice[window.GV.DEVICE_ID]||[])
      .map(u=>{
        const c=(window.__coupons||[]).find(x=>x.id===u.couponId);
        return c?{...u,title:c.title,desc:c.desc}:null;
      })
      .filter(Boolean);
    setUnlocked(arr);
    return granted;
  }

  function onGnomeMatched(gnomeId){
    if(!found.includes(gnomeId)) setFound(p=>[...p,gnomeId]);
    window.__scans.push({gnomeId,ts:Date.now(),deviceId:window.GV.DEVICE_ID,userEmail:user?.email});
    const g = window.GV.GNOMES.find(x=>x.id===gnomeId);
    const unlockedCount=grantOnScan(gnomeId);
    setCelebrate({gnomeId,name:g?.name,image:g?.image});
    try { window.GV.celebrateRain(); } catch(e){}
    setMessage(`Matched trigger for #${gnomeId}. ${unlockedCount>0?`Unlocked ${unlockedCount} coupon(s).`:''}`);
  }

  async function openScanner(){
    try{
      const constraints={video:{facingMode:"environment"}};
      const stream=await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current=stream; setScanOpen(true); setTimeout(startScanLoop,30);
    }catch(e){ alert("Camera access denied or unavailable."); }
  }
  function closeScanner(){
    cancelAnimationFrame(loopRef.current);
    if(streamRef.current){ streamRef.current.getTracks().forEach(t=>t.stop()); streamRef.current=null; }
    setScanOpen(false);
  }

  // === NEW: image-trigger detection (perceptual hash) ===
  function startScanLoop(){
    const video=videoRef.current, canvas=canvasRef.current; if(!video||!canvas) return;
    video.srcObject=streamRef.current; video.setAttribute('playsinline',true); video.play();
    const ctx=canvas.getContext('2d');

    // If QR mode, we don't do image matching - just show the QR input
    if(scanMode==='qr'){
      // QR scanning will be handled by the manual input in the UI
      return;
    }

    const targetList = Object.entries(window.__triggerImages||{}).map(([gid,obj])=>({gnomeId:Number(gid),hash:obj.aHash})).filter(t=>!!t.hash);
    const THRESHOLD = 10; // hamming distance threshold (lower = stricter)

    const tick=()=>{
      if(video.readyState===video.HAVE_ENOUGH_DATA){
        // downscale to 8x8 to compute aHash quickly
        const size=8;
        canvas.width=size; canvas.height=size;
        ctx.drawImage(video,0,0,size,size);
        const data=ctx.getImageData(0,0,size,size).data;
        // compute aHash inline (no extra alloc to keep fast)
        let sum=0; const gray=new Array(size*size);
        for(let i=0;i<gray.length;i++){
          const r=data[i*4], g=data[i*4+1], b=data[i*4+2];
          const v=(r*0.299 + g*0.587 + b*0.114)|0;
          gray[i]=v; sum+=v;
        }
        const avg=sum/gray.length;
        let frameHash=0n;
        for(let i=0;i<gray.length;i++){
          frameHash = (frameHash<<1n) | (gray[i]>=avg ? 1n : 0n);
        }

        // Compare with all active triggers
        for(const t of targetList){
          const a = frameHash ^ t.hash; // count bits
          let bits=a, count=0;
          while(bits){ count++; bits &= (bits-1n); }
          if(count <= THRESHOLD){
            closeScanner();
            onGnomeMatched(t.gnomeId);
            return;
          }
        }
      }
      loopRef.current=requestAnimationFrame(tick);
    };
    loopRef.current=requestAnimationFrame(tick);
  }

  function showQrClueFromData(data){
    // Expect "GNOME:<id>"
    const m = String(data||'').trim().match(/^GNOME:(\d{1,2})$/i);
    if(!m){ alert('Unrecognized QR data. Expected GNOME:<id>.'); return; }
    const id = Number(m[1]);
    const g  = window.GV.GNOMES.find(x=>x.id===id);
    const assign = window.__gnomeAssignments[id];
    const partner = assign ? (window.__partners||[]).find(p=>p.id===assign.partnerId) : null;
    const trig = window.__triggerImages[id];

    // Build dynamic "extra clue" based on the uploaded trigger image
    const thumb = trig?.dataUrl || '';
    const riddle = partner ? (`Seek the emblem where ${partner.establishment} leaves its mark — the right logo wakes the gnome.`)
                          : `Seek the host's emblem; the right logo wakes the gnome.`;
    const hint   = activePartnerHintFor(id)?.text || '';
    const clueHtml = `
      <div style="font-size:12px">
        <div><em>${riddle}</em></div>
        ${hint ? `<div style="margin-top:4px">Hint: ${hint}</div>` : ''}
        ${thumb ? `<div style="margin-top:6px"><img src="${thumb}" style="width:100%;max-height:120px;object-fit:cover;border-radius:8px;border:1px solid #eee" /></div>` : ''}
        <div style="margin-top:6px;color:#555">Tip: Use "Image Unlock" mode at the location to scan this emblem/logo.</div>
      </div>`;

    setQrClue({ gnomeId:id, name:g?.name, thumbUrl:thumb, clueHtml });
  }

  function redeem(code){
    const meta=window.__uniqueCodes[code]; if(!meta) return alert("Invalid code.");
    if(meta.deviceId!==window.GV.DEVICE_ID) return alert("Not valid for this device.");
    if(meta.used) return alert("Already used.");
    meta.used=true; window.__redemptions.push({ts:Date.now(),deviceId:window.GV.DEVICE_ID,code,couponId:meta.couponId,gnomeId:meta.gnomeId});
    alert("Redeemed!");
  }
  function addToWallet(couponId){
    if(!window.__walletSubs[window.GV.DEVICE_ID]) window.__walletSubs[window.GV.DEVICE_ID]=new Set();
    window.__walletSubs[window.GV.DEVICE_ID].add(couponId);
    try{
      const blob=new Blob([`WildFlower Wallet Pass\nDevice:${window.GV.DEVICE_ID}\nCoupon:${couponId}`],{type:"application/vnd.apple.pkpass"});
      const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`wildflower-${couponId}.pkpass`; a.click(); URL.revokeObjectURL(a.href);
    }catch(e){}
    setUnlocked(u=>[...u]);
  }
  function removeFromWallet(couponId){
    if(window.__walletSubs[window.GV.DEVICE_ID]) window.__walletSubs[window.GV.DEVICE_ID].delete(couponId);
    setUnlocked(u=>[...u]);
  }

  // Map & presence
  function colorForGender(g){ return g==='male'?'#2563eb':g==='female'?'#ec4899':'#eab308'; }
  function initMap(){
    if(mapRef.current) return;
    const map=window.L.map('map').setView([27.977,-82.832],13);
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
    mapRef.current=map;
    window.GV.GNOMES.forEach(g=>{
      const a=window.__gnomeAssignments[g.id]; if(!(a&&a.active)) return;
      const p=(window.__partners||[]).find(pp=>pp.id===a.partnerId);
      const {lat,lng}=window.GV.addrToLatLng(p?.address||''); const icon=window.L.icon({iconUrl:g.image,iconSize:[40,40],iconAnchor:[20,20]});
      const m=window.L.marker([lat,lng],{icon}).addTo(map);
      const riddle=riddleForPartner(p); const hint=activePartnerHintFor(g.id)?.text || '';
      const url=`https://maps.apple.com/?daddr=${lat},${lng}`;
      m.bindPopup(`<div style="min-width:180px"><strong>#${g.id} ${g.name}</strong><div style="margin-top:4px;font-size:12px"><em>${riddle}</em></div>${hint?`<div style="margin-top:4px;font-size:12px">Hint: ${hint}</div>`:''}<div style="margin-top:6px"><a href="${url}" target="_blank" rel="noopener">Get Directions</a></div></div>`);
    });
  }
  function enableMap(){
    setMapOn(true); setTimeout(initMap,30);
    if(navigator.geolocation){
      let firstUpdate = true;
      watchIdRef.current = navigator.geolocation.watchPosition(pos=>{
        const {latitude,longitude}=pos.coords; const color=colorForGender(gender);
        const icon=window.L.divIcon({className:'',html:`<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 0 0 1px rgba(0,0,0,.2)"></div>`});
        if(meMarkerRef.current) meMarkerRef.current.setLatLng([latitude,longitude]);
        else meMarkerRef.current=window.L.marker([latitude,longitude],{icon}).addTo(mapRef.current);
        // Only center map on first location update, then let user pan freely
        if(firstUpdate){
          mapRef.current.setView([latitude,longitude],14);
          firstUpdate = false;
        }
      },()=>{}, {enableHighAccuracy:true,maximumAge:10000,timeout:10000});
    }
  }
  function disableMap(){
    setMapOn(false);
    if(watchIdRef.current) try{navigator.geolocation.clearWatch(watchIdRef.current)}catch(e){}
    watchIdRef.current=null;
  }

  // Dynamic clues list (unchanged except riddle text now references scanning logos)
  const clues=useMemo(()=>window.GV.GNOMES.map(g=>{
    const a=window.__gnomeAssignments[g.id]; const active=!!a?.active;
    let base=null, extra=null, partner=null;
    if(active){ partner=(window.__partners||[]).find(p=>p.id===a.partnerId); base=riddleForPartner(partner); extra=activePartnerHintFor(g.id)?.text||null; }
    return { gnome:g, active, partner, riddle:base, hint:extra };
  }),[window.__gnomeAssignments,window.__partnerHints]);

  return (
    <div className="space-y-4">
      <window.Components.ParticipantIntro />
      {/* Progress */}
      <div className="rounded-2xl border p-3 bg-white">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Your Progress</h3>
          {user && <div className="text-[11px] text-gray-600">Signed in as <span className="font-mono">{user.email}</span></div>}
        </div>
        <div className="text-xs text-gray-600">Progress {found.length}/{window.GV.GNOMES.length} ({progressPct}%)</div>
        <div className="h-2 w-full rounded bg-gray-200"><div className="h-2 rounded bg-black" style={{width:`${progressPct}%`}}/></div>
      </div>

      {/* Clues */}
      <div className="rounded-2xl border p-3 bg-white">
        <h3 className="font-semibold text-sm mb-2">Current Clues</h3>
        <div className="grid md:grid-cols-2 gap-2 text-xs">
          {clues.map(({gnome,active,riddle,hint,partner})=>(
            <div key={gnome.id} className="rounded border p-2">
              <div className="flex items-center gap-2">
                <img src={gnome.image} className="w-6 h-6 object-contain float-gnome-sm" alt=""/>
                <div className="font-semibold">#{gnome.id} {gnome.name}</div>
                <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full border ${active?'bg-green-50 border-green-500':'bg-gray-50'}`}>{active?'Active':'Unavailable'}</span>
              </div>
              {active?<>
                <div className="mt-1 text-gray-700 italic">"{riddle}"</div>
                <div className="mt-1 text-gray-600">Tip: Use your camera to scan the correct logo/image when you arrive.</div>
                {hint && <div className="mt-1 text-gray-600">Hint: {hint}</div>}
                {partner && <div className="mt-1 text-[11px] text-gray-500">Hosted by: <span className="font-mono">{partner.establishment||partner.name}</span></div>}
              </>:<div className="mt-1 text-gray-500">Waiting for winning Partner to activate.</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Scanner */}
      <div className="rounded-2xl border p-3 bg-white">
        <h3 className="font-semibold text-sm mb-2">Scan Hidden Emblem</h3>
        <div className="flex gap-2">
          <button className="rounded bg-black text-white px-3 py-1.5 text-sm" onClick={()=>{setScanMode('image'); openScanner();}}>Image Unlock</button>
          <button className="rounded bg-emerald-600 text-white px-3 py-1.5 text-sm" onClick={()=>{setScanMode('qr'); openScanner();}}>Scan QR for Clue</button>
          <button className="rounded border px-3 py-1.5 text-sm" onClick={()=>alert('Image Unlock: Point your camera at the correct logo/image at the location. When it matches, your gnome unlocks automatically!\n\nScan QR for Clue: Scan a QR code from a poster to see dynamic clues about which emblem to look for.')}>Help</button>
        </div>
        {message && <p className="mt-2 text-xs text-gray-700">{message}</p>}
      </div>

      {/* Scanner modal */}
      {scanOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="scan-box">
            <video ref={videoRef} style={{width:'100%',height:'auto'}} autoPlay muted playsInline></video>
            <canvas ref={canvasRef} style={{display:'none'}}></canvas>
            <div className="scan-overlay"></div>
            <div className="absolute top-2 right-2"><button className="rounded bg-white/90 px-2 py-1 text-sm" onClick={closeScanner}>Close</button></div>
            {scanMode==='image' ? (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-white text-xs bg-black/40 rounded px-2 py-1">Scan the correct emblem/logo to unlock.</div>
            ) : (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[90%] bg-white/95 rounded-lg p-3">
                <div className="text-xs font-semibold mb-1">QR Clue Scanner</div>
                <input type="text" placeholder="Paste GNOME:# code here" id="qrInput" className="w-full border rounded px-2 py-1 text-xs mb-2"/>
                <button className="w-full rounded bg-emerald-600 text-white px-3 py-1.5 text-xs" onClick={()=>{
                  const val=document.getElementById('qrInput').value;
                  showQrClueFromData(val);
                  closeScanner();
                }}>Show Clue</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Celebration card */}
      {celebrate && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={()=>setCelebrate(null)}>
          <div className="w-[90vw] max-w-sm rounded-2xl bg-white border p-4 text-center" onClick={e=>e.stopPropagation()}>
            <div className="text-sm font-semibold">Gnome Unlocked!</div>
            <div className="mt-2 flex items-center justify-center">
              <img src={celebrate.image} alt="" className="w-24 h-24 object-contain float-gnome"/>
            </div>
            <div className="mt-1 text-xs text-gray-600">#{celebrate.gnomeId} {celebrate.name}</div>
            <div className="mt-3">
              <button className="rounded bg-black text-white px-3 py-1.5 text-sm" onClick={()=>setCelebrate(null)}>Nice!</button>
            </div>
          </div>
        </div>
      )}

      {/* Wallet */}
      <div className="rounded-2xl border p-3 bg-white">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-sm">Rewards Wallet</h3>
          <span className="text-[11px] text-gray-500">Codes are device-bound and one-time</span>
        </div>
        <div className="grid md:grid-cols-3 gap-2">
          {unlocked.length===0 && <div className="text-xs text-gray-500">No coupons unlocked yet…</div>}
          {unlocked.map((u,i)=>(
            <div key={i} className="rounded-lg border p-2">
              <div className="text-[11px] text-gray-500">Coupon</div>
              <div className="font-semibold text-sm">{u.title}</div>
              <div className="text-xs text-gray-600">{u.desc}</div>
              <div className="mt-1 text-[11px]">Code</div>
              <div className="font-mono text-sm break-all">{u.code}</div>
              <div className="mt-2 flex items-center gap-2">
                <button className="rounded bg-black text-white px-2 py-1 text-xs" onClick={()=>redeem(u.code)}>Redeem</button>
                {window.__walletSubs[window.GV.DEVICE_ID]?.has(u.couponId)
                  ? <button className="rounded border px-2 py-1 text-xs" onClick={()=>removeFromWallet(u.couponId)}>Remove from Wallet</button>
                  : <button className="rounded border px-2 py-1 text-xs" onClick={()=>addToWallet(u.couponId)}>Add to Wallet</button>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* QR Clue Card */}
      {qrClue && (
        <div className="rounded-2xl border p-3 bg-gradient-to-br from-emerald-50 to-white">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm">QR Clue: {qrClue.name || `Gnome #${qrClue.gnomeId}`}</h3>
            <button className="text-xs text-gray-500 hover:text-black" onClick={()=>setQrClue(null)}>✕ Close</button>
          </div>
          <div dangerouslySetInnerHTML={{__html: qrClue.clueHtml}}></div>
        </div>
      )}

      {/* Map */}
      <div className="rounded-2xl border p-3 bg-white">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-sm">Live Map & Nearby Gnomes</h3>
          <div className="flex items-center gap-2 text-xs">
            <label className="flex items-center gap-1"><span>Gender</span>
              <select className="border rounded px-2 py-1" value={gender} onChange={e=>setGender(e.target.value)}>
                <option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
              </select>
            </label>
            {!mapOn
              ? <button className="rounded bg-black text-white px-3 py-1.5" onClick={enableMap}>Enable Location</button>
              : <button className="rounded border px-3 py-1.5" onClick={disableMap}>Disable</button>}
          </div>
        </div>
        <p className="text-[11px] text-gray-600 mb-2">Active gnomes appear at Partner addresses. Your dot is shared so players can meet up.</p>
        {mapOn ? <div id="map"></div> : <div className="text-xs text-gray-500">Location is off.</div>}
      </div>

      <window.Components.PopularityGrid title="Gnome Popularity — Last 30 Days" showActive={true}/>
    </div>
  );
}

/* =============================================================================
   ADVERTISER COMPONENT
============================================================================= */
function Advertiser({user}){
  const advIdRef=useRef(null);
  const [celebration, setCelebration] = useState(null);
  
  useEffect(()=>{
    if(!user) return;
    let adv=(window.__advertisers||[]).find(a=>a.email===user.email) ||
             (window.__advertisers||[]).find(a=>a.name===user.name);
    if(!adv){
      adv = { id:'adv-'+Math.random().toString(36).slice(2,8), name:user.name||'Advertiser', email:user.email, cardOnFile:false, blocked:false };
      window.__advertisers.push(adv);
    }
    advIdRef.current=adv.id;
    setCard(!!adv.cardOnFile);

    // Check for unclaimed unlock celebrations
    const myUnlockEvents = (window.__advertiserUnlockEvents || []).filter(e => e.advertiserId === adv.id && !e.claimed);
    if (myUnlockEvents.length > 0) {
      const firstEvent = myUnlockEvents[0];
      setCelebration(firstEvent);
      firstEvent.claimed = true;
    }
  },[user]);

  const [title,setTitle]=useState("20% off up to $500");
  const [desc,setDesc]=useState("Good for dine-in only. One-time use.");
  const [target,setTarget]=useState("one");
  const [gnomeId,setGnomeId]=useState(1);
  const [start,setStart]=useState("");
  const [end,setEnd]=useState("");
  const [scanCap,setScanCap]=useState(0);
  const [active,setActive]=useState(true);
  const [card,setCard]=useState(false);
  const [pushText,setPushText]=useState("Your wallet coupon is waiting! Come redeem today.");
  const [msg,setMsg]=useState("");

  const couponsForMe=(window.__coupons||[]).filter(c=>c.advertiserId===advIdRef.current);
  const myCharges=(window.__charges||[]).filter(c=>c.type==='advertiser' && c.advertiserId===advIdRef.current);
  const spent=myCharges.reduce((a,b)=>a+(b.amount||0),0);

  function saveCardOnFile(){
    window.GV.performAction(async () => {
      const adv=(window.__advertisers||[]).find(a=>a.id===advIdRef.current);
      if(!adv) return;
      adv.cardOnFile=true; setCard(true);
      setMsg("Card authorized for per-unlock charges.");
    }, "Card Authorized!");
  }

  function createCoupon(){
    window.GV.performAction(async () => {
      if(!card){ setMsg("Please add a card on file to create paid coupons."); return; }
      const id='cp-'+Math.random().toString(36).slice(2,8);
      const s = start? new Date(start).getTime(): undefined;
      const e = end? new Date(end).getTime(): undefined;
      window.__coupons.push({
        id, advertiserId:advIdRef.current, system:false,
        title, desc, target, gnomeId: target==='one'? Number(gnomeId): undefined,
        startAt:s, endAt:e, scanCap: Number(scanCap)||0,
        unlocks:0, active, blocked:false
      });
      setMsg("Coupon created.");
    }, "Coupon Created!");
  }

  function toggleActive(c){
    window.GV.performAction(async () => {
      c.active = !c.active;
      setMsg(`Coupon ${c.active?'activated':'paused'}.`);
    }, c.active ? "Coupon Activated!" : "Coupon Paused!");
  }

  function sendWalletPush(coupon){
    window.GV.performAction(async () => {
      let sent=0;
      for(const [device, set] of Object.entries(window.__walletSubs||{})){
        if(set.has(coupon.id)) sent++;
      }
      alert(`Push sent to ${sent} wallet devices.\n\n"${pushText}"`);
    }, "Push Sent!");
  }

  return (
    <div className="space-y-4">
      <window.Components.AdvertiserIntro />
      {/* account/ledger/analytics */}
      <div className="rounded-2xl border p-3 bg-white">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Advertiser Account</h3>
          <div className="text-[11px] text-gray-600">Logged in: <span className="font-mono">{user?.email||'—'}</span></div>
        </div>
        <div className="text-xs grid md:grid-cols-3 gap-2 items-end">
          <div className="rounded border p-2">
            <div className="font-semibold">Billing</div>
            <div className="text-[11px] text-gray-600">Per unlock: {window.GV.fmtMoney(window.__costPerUnlock)} (once per device/gnome/cycle)</div>
            <div className="mt-1">
              {card
                ? <span className="inline-block text-[11px] px-2 py-0.5 rounded-full border bg-green-50 border-green-500">Card on file</span>
                : <button className="rounded bg-black text-white px-2 py-1 text-xs" onClick={saveCardOnFile}>Add card & authorize</button>}
            </div>
          </div>
          <div className="rounded border p-2">
            <div className="font-semibold">Ledger</div>
            <div className="text-[11px]">Charges: <span className="font-mono">{myCharges.length}</span></div>
            <div className="text-[11px]">Total: <span className="font-mono">{window.GV.fmtMoney(spent)}</span></div>
          </div>
          <div className="rounded border p-2">
            <div className="font-semibold">Analytics (30d)</div>
            <div className="text-[11px]">Avg scans / gnome: <span className="font-mono">{Math.round(window.GV.popularity30d().reduce((a,b)=>a+b.scans,0)/window.GV.GNOMES.length)}</span></div>
          </div>
        </div>
        {msg && <div className="mt-2 text-xs text-green-700">{msg}</div>}
      </div>

      {/* Unlocked Gnomes Section */}
      <div className="rounded-2xl border p-3 bg-white">
        <h3 className="font-semibold text-sm mb-2">Unlocked Gnomes</h3>
        <div className="text-[11px] text-gray-600 mb-3">Your coupons unlocked via gnome scans</div>
        {(() => {
          // Calculate unlocks per gnome from charges
          const unlocksByGnome = {};
          myCharges.forEach(charge => {
            if (!charge.gnomeId) return;
            if (!unlocksByGnome[charge.gnomeId]) {
              const gnome = window.GV.GNOMES.find(g => g.id === charge.gnomeId);
              unlocksByGnome[charge.gnomeId] = {
                gnomeId: charge.gnomeId,
                gnomeName: gnome?.name || `Gnome ${charge.gnomeId}`,
                gnomeImage: gnome?.image,
                scans: 0,
                charges: 0
              };
            }
            unlocksByGnome[charge.gnomeId].scans++;
            unlocksByGnome[charge.gnomeId].charges += charge.amount || 0;
          });

          const unlockedList = Object.values(unlocksByGnome);
          
          if (unlockedList.length === 0) {
            return <div className="text-xs text-gray-500">No unlocks yet. Create coupons to start earning!</div>;
          }

          return (
            <div className="grid md:grid-cols-5 gap-2">
              {unlockedList.map(unlock => (
                <div key={unlock.gnomeId} className="rounded border p-2 text-center">
                  <img src={unlock.gnomeImage} alt={unlock.gnomeName} className="w-12 h-12 mx-auto object-contain mb-2" />
                  <div className="font-semibold text-xs">#{unlock.gnomeId} {unlock.gnomeName}</div>
                  <div className="text-[11px] text-gray-600 mt-1">Scans: <span className="font-mono">{unlock.scans}</span></div>
                  <div className="text-[11px] text-gray-600">Charges: <span className="font-mono">{window.GV.fmtMoney(unlock.charges)}</span></div>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {/* create/manage coupons */}
      <div className="rounded-2xl border p-3 bg-white">
        <h3 className="font-semibold text-sm mb-2">Create / Manage Coupons</h3>
        <div className="grid md:grid-cols-4 gap-2 text-xs">
          <label className="grid gap-1">Title<input className="border rounded px-2 py-1" value={title} onChange={e=>setTitle(e.target.value)}/></label>
          <label className="grid gap-1 md:col-span-2">Description<input className="border rounded px-2 py-1" value={desc} onChange={e=>setDesc(e.target.value)}/></label>
          <label className="grid gap-1">Target
            <select className="border rounded px-2 py-1" value={target} onChange={e=>setTarget(e.target.value)}>
              <option value="one">Specific gnome</option>
              <option value="all">All gnomes</option>
              <option value="golden">Golden gnome</option>
            </select>
          </label>
          {target==='one' && <label className="grid gap-1">Gnome ID
            <input type="number" className="border rounded px-2 py-1" value={gnomeId} onChange={e=>setGnomeId(e.target.value)}/>
          </label>}
          <label className="grid gap-1">Start
            <input type="datetime-local" className="border rounded px-2 py-1" value={start} onChange={e=>setStart(e.target.value)}/>
          </label>
          <label className="grid gap-1">End
            <input type="datetime-local" className="border rounded px-2 py-1" value={end} onChange={e=>setEnd(e.target.value)}/>
          </label>
          <label className="grid gap-1">Scan cap (0=unlimited)
            <input type="number" className="border rounded px-2 py-1" value={scanCap} onChange={e=>setScanCap(e.target.value)}/>
          </label>
          <label className="flex items-center gap-2 mt-5"><input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)}/> Active</label>
          <div className="md:col-span-4">
            <button className="rounded bg-black text-white px-3 py-1.5 text-sm" onClick={createCoupon} disabled={!card}>Create Coupon</button>
          </div>
        </div>

        <div className="mt-4">
          <h4 className="font-semibold text-sm mb-1">Your Coupons</h4>
          <div className="grid md:grid-cols-2 gap-2 text-xs">
            {couponsForMe.length===0 && <div className="text-gray-500">No coupons yet.</div>}
            {couponsForMe.map(c=>(
              <div key={c.id} className="rounded border p-2">
                <div className="flex items-center gap-2">
                  <div className="font-semibold">{c.title}</div>
                  <span className="ml-auto"><window.Components.ActiveBadge active={c.active}/></span>
                </div>
                <div className="text-[11px] text-gray-600">{c.desc}</div>
                <div className="mt-1 text-[11px]">Target: <span className="font-mono">{c.target}{c.target==='one'?` #${c.gnomeId}`:''}</span></div>
                <div className="text-[11px]">Window: <span className="font-mono">{c.startAt?new Date(c.startAt).toLocaleString():'—'} → {c.endAt?new Date(c.endAt).toLocaleString():'—'}</span></div>
                <div className="text-[11px]">Unlocks: <span className="font-mono">{c.unlocks||0}</span>{c.scanCap?` / ${c.scanCap}`:''}</div>
                <div className="mt-2 flex items-center gap-2">
                  <button className="rounded border px-2 py-1" onClick={()=>toggleActive(c)}>{c.active?'Pause':'Activate'}</button>
                  <input className="border rounded px-2 py-1 flex-1" placeholder="Wallet push message" value={pushText} onChange={e=>setPushText(e.target.value)}/>
                  <button className="rounded bg-black text-white px-2 py-1" onClick={()=>sendWalletPush(c)}>Send Push</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <window.Components.PopularityGrid title="Gnome Popularity — 30d (Active state shown)" showActive={true}/>

      {/* Celebration Modal */}
      {celebration && (
        <window.Components.CelebrationModal
          gnomeImage={celebration.gnomeImage}
          gnomeName={celebration.gnomeName}
          gnomeId={celebration.gnomeId}
          message={`Gnome #${celebration.gnomeId} ${celebration.gnomeName} was just unlocked! "${celebration.couponTitle}" coupon granted.`}
          onClose={() => setCelebration(null)}
        />
      )}
    </div>
  );
}

/* =============================================================================
   PARTNERS COMPONENT
============================================================================= */
function Partners({user}){
  const partnerRef=useRef(null);
  const [est,setEst]=useState(""); const [addr,setAddr]=useState("");
  const [card,setCard]=useState(false);
  const [bid,setBid]=useState(0); const [bidGnome,setBidGnome]=useState(1);
  const [msg,setMsg]=useState("");
  const [hintText,setHintText]=useState("Extra hint: follow the songs.");
  const [hintMinutes,setHintMinutes]=useState(15);
  const [uploadGnome,setUploadGnome]=useState(1);
  const [uploadFile,setUploadFile]=useState(null);
  const [celebration,setCelebration]=useState(null);
  const [uploadFiles, setUploadFiles] = useState({}); // Track files per gnome {gnomeId: file}

  useEffect(()=>{
    if(!user) return;
    let p=(window.__partners||[]).find(x=>x.email===user.email) ||
           (window.__partners||[]).find(x=>x.name===user.name);
    if(!p){
      p={id:'par-'+Math.random().toString(36).slice(2,8),name:user.name||'Partner',email:user.email,establishment:'',address:'',cardOnFile:false,blocked:false};
      window.__partners.push(p);
    }
    partnerRef.current=p; setEst(p.establishment||""); setAddr(p.address||""); setCard(!!p.cardOnFile);

    // Check for unclaimed celebrations
    const myCelebrations = (window.__partnerCelebrations || []).filter(c => c.partnerId === p.id && !c.claimed);
    if (myCelebrations.length > 0) {
      // Show first unclaimed celebration
      const firstCelebration = myCelebrations[0];
      setCelebration(firstCelebration);
      // Mark as claimed
      firstCelebration.claimed = true;
    }
  },[user]);

  const myWins = window.GV.GNOMES.filter(g=>window.__gnomeAssignments[g.id]?.partnerId===partnerRef.current?.id)
    .map(g=>{
      const assign=window.__gnomeAssignments[g.id];
      const prevId=assign?.previousPartnerId;
      const prev=(window.__partners||[]).find(pp=>pp.id===prevId)||null;
      return {gnome:g, active:!!assign?.active, prev};
    });

  function saveProfile(){
    window.GV.performAction(async () => {
      const p=partnerRef.current; if(!p) return;
      p.establishment=est; p.address=addr; setMsg("Profile saved.");
    }, "Profile Saved!");
  }
  function saveCard(){
    window.GV.performAction(async () => {
      const p=partnerRef.current; if(!p) return;
      p.cardOnFile=true; setCard(true); setMsg("Card on file & authorized.");
    }, "Card Authorized!");
  }
  function placeBid(){
    window.GV.performAction(async () => {
      const p=partnerRef.current; if(!p) return;
      if(!p.cardOnFile){ setMsg("Add a card on file before bidding."); return; }
      if(!est || !addr){ setMsg("Please provide establishment and address before bidding."); return; }
      const amt=Math.max(0,Number(bid)||0);
      window.__partnerBids.push({id: Number(bidGnome), amt, partnerId:p.id, ts:Date.now()});
      setMsg(`Bid placed for #${bidGnome} at ${window.GV.fmtMoney(amt)}.`);
    }, "Bid Placed!");
  }
  function toggleActivate(gid){
    window.GV.performAction(async () => {
      const a=window.__gnomeAssignments[gid]; if(!a) return;
      a.active=!a.active;
      setMsg(`Gnome #${gid} is now ${a.active?'Active':'Inactive'}.`);
    }, a?.active ? "Gnome Activated!" : "Gnome Deactivated!");
  }
  function pushHint(gnomeId){
    window.GV.performAction(async () => {
      const expiresAt=Date.now() + Math.max(1,Number(hintMinutes)||10)*60000;
      window.__partnerHints.push({gnomeId, text:hintText, expiresAt, partnerId: partnerRef.current.id});
      setMsg(`Hint pushed for #${gnomeId} for ${hintMinutes} min.`);
    }, "Hint Pushed!");
  }

  // submit a trigger image to Admin (goes to review queue)
  function submitTriggerImage(gnomeId){
    window.GV.performAction(async () => {
      const p=partnerRef.current; if(!p) return;
      const file = uploadFiles[gnomeId];
      if(!file){ setMsg(`Choose an image for #${gnomeId} first.`); return; }
      
      return new Promise((resolve) => {
        const reader=new FileReader();
        reader.onload=async (e)=>{
          const dataUrl=e.target.result;
          try{
            const hash=await window.GV.aHashFromDataUrl(dataUrl);
            window.__submittedTriggers.push({partnerId:p.id,gnomeId:Number(gnomeId),dataUrl, aHash:hash, ts:Date.now(), approved: false});
            setMsg(`Submitted trigger for #${gnomeId} to Admin.`);
            // Clear this file
            setUploadFiles({...uploadFiles, [gnomeId]: null});
            resolve();
          }catch(err){
            setMsg("Failed to process image.");
            resolve();
          }
        };
        reader.readAsDataURL(file);
      });
    }, "Trigger Image Submitted!");
  }

  function highestFor(id){
    let max=0, by=null;
    for(const r of (window.__partnerBids||[])){ if(r.id===id && r.amt>max){ max=r.amt; by=r.partnerId; } }
    const who=(window.__partners||[]).find(p=>p.id===by);
    return {max,who};
  }

  return (
    <div className="space-y-4">
      <window.Components.PartnersIntro />
      
      {/* Pending Approvals */}
      {(() => {
        const p = partnerRef.current;
        if (!p) return null;
        const pendingTriggers = (window.__submittedTriggers || []).filter(t => t.partnerId === p.id);
        if (pendingTriggers.length === 0) return null;
        
        const pendingItems = pendingTriggers.map(t => {
          const gnome = window.GV.GNOMES.find(g => g.id === t.gnomeId);
          const approved = window.__triggerImages[t.gnomeId]?.aHash === t.aHash;
          return {
            id: `trigger-${t.gnomeId}-${t.ts}`,
            label: `Trigger image for #${t.gnomeId} ${gnome?.name || ''}`,
            approved
          };
        });
        
        return <window.Components.PendingApprovals items={pendingItems} onApprove={() => {}} />;
      })()}
      
      {/* profile */}
      <div className="rounded-2xl border p-3 bg-white">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Partner Account</h3>
          <div className="text-[11px] text-gray-600">Logged in: <span className="font-mono">{user?.email||'—'}</span></div>
        </div>
        <div className="text-xs grid md:grid-cols-3 gap-2 items-end">
          <label className="grid gap-1">Establishment
            <input className="border rounded px-2 py-1" value={est} onChange={e=>setEst(e.target.value)}/>
          </label>
          <label className="grid gap-1 md:col-span-2">Address
            <input className="border rounded px-2 py-1" value={addr} onChange={e=>setAddr(e.target.value)}/>
          </label>
          <div className="md:col-span-3 flex items-center gap-2">
            <button className="rounded border px-2 py-1 text-xs" onClick={saveProfile}>Save Profile</button>
            {card
              ? <span className="text-[11px] px-2 py-0.5 rounded-full border bg-green-50 border-green-500">Card on file</span>
              : <button className="rounded bg-black text-white px-2 py-1 text-xs" onClick={saveCard}>Add card & authorize</button>}
          </div>
        </div>
        {msg && <div className="mt-2 text-xs text-green-700">{msg}</div>}
      </div>

      {/* bidding */}
      <div className="rounded-2xl border p-3 bg-white">
        <h3 className="font-semibold text-sm mb-2">Bid for Gnomes</h3>
        <div className="grid md:grid-cols-2 gap-2 text-xs">
          <label className="grid gap-1">Gnome
            <select className="border rounded px-2 py-1" value={bidGnome} onChange={e=>setBidGnome(e.target.value)}>
              {window.GV.GNOMES.map(g=><option key={g.id} value={g.id}>#{g.id} {g.name}</option>)}
            </select>
          </label>
          <label className="grid gap-1">Your Bid (USD)
            <input type="number" className="border rounded px-2 py-1" value={bid} onChange={e=>setBid(e.target.value)}/>
          </label>
          <div className="md:col-span-2">
            <button className="rounded bg-black text-white px-3 py-1.5 text-sm" onClick={placeBid} disabled={!card}>Place Bid</button>
          </div>
        </div>

        <div className="mt-3 grid md:grid-cols-2 gap-2">
          {window.GV.GNOMES.map(g=>{
            const {max,who}=highestFor(g.id);
            const holder=window.__gnomeAssignments[g.id]?.partnerId;
            const holderRec=(window.__partners||[]).find(p=>p.id===holder);
            return (
              <div key={g.id} className="rounded border p-2 text-xs">
                <div className="flex items-center gap-2">
                  <img src={g.image} className="w-5 h-5 object-contain" alt=""/><div className="font-semibold">#{g.id} {g.name}</div>
                  <div className="ml-auto text-[11px]">Top bid: <span className="font-mono">{window.GV.fmtMoney(max)}</span> {who?` by ${who.establishment||who.name||'Partner'}`:''}</div>
                </div>
                <div className="mt-1 text-[11px] text-gray-600">Currently located at: <span className="font-mono">{holderRec?.establishment||holderRec?.name||'—'}</span></div>
                <div className="text-[11px] text-gray-500">Pickup address: <span className="font-mono">{holderRec?.address||'—'}</span></div>
              </div>
            );
          })}
        </div>
      </div>

      {/* my winning gnomes + activate + hint push + submit trigger */}
      <div className="rounded-2xl border p-3 bg-white">
        <h3 className="font-semibold text-sm mb-2">Your Winning Gnomes</h3>
        <div className="text-[11px] text-gray-600 mb-2">Activate a gnome when it's hidden. Submit a trigger image for Admin to approve.</div>
        <div className="grid md:grid-cols-2 gap-2 text-xs">
          {myWins.length===0 && <div className="text-gray-500">No assigned gnomes yet.</div>}
          {myWins.map(({gnome,active,prev})=>(
            <div key={gnome.id} className="rounded border p-2">
              <div className="flex items-center gap-2">
                <img src={gnome.image} className="w-5 h-5 object-contain" alt=""/><div className="font-semibold">#{gnome.id} {gnome.name}</div>
                <span className="ml-auto"><window.Components.ActiveBadge active={active}/></span>
              </div>
              <div className="mt-1 text-[11px] text-gray-600">Previous holder: <span className="font-mono">{prev?.establishment||prev?.name||'—'}</span></div>
              <div className="text-[11px] text-gray-500">Pickup: <span className="font-mono">{prev?.address||'—'}</span></div>
              <div className="mt-2 flex items-center gap-2">
                <button className="rounded border px-2 py-1" onClick={()=>toggleActivate(gnome.id)}>{active?'Deactivate':'Activate'}</button>
                <input className="border rounded px-2 py-1 flex-1" placeholder="Manual clue to push" value={hintText} onChange={e=>setHintText(e.target.value)}/>
                <input type="number" className="border rounded px-2 py-1 w-24" value={hintMinutes} onChange={e=>setHintMinutes(e.target.value)}/>
                <button className="rounded bg-black text-white px-2 py-1" onClick={()=>pushHint(gnome.id)}>Push Hint</button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-3">
          <div className="font-semibold text-xs">Submit Trigger Images to Admin</div>
          {myWins.length === 0 && <div className="text-gray-500 text-xs">No assigned gnomes yet.</div>}
          {myWins.map(({gnome}) => (
            <div key={gnome.id} className="rounded border p-2 text-xs">
              <div className="flex items-center gap-2 mb-2">
                <img src={gnome.image} className="w-5 h-5 object-contain" alt=""/>
                <div className="font-semibold">#{gnome.id} {gnome.name}</div>
              </div>
              <div className="flex gap-2 items-end">
                <input 
                  type="file" 
                  accept="image/*" 
                  className="border rounded px-2 py-1 flex-1" 
                  onChange={e => setUploadFiles({...uploadFiles, [gnome.id]: e.target.files?.[0]||null})}
                />
                <button 
                  className="rounded bg-black text-white px-3 py-1.5" 
                  onClick={() => submitTriggerImage(gnome.id)}
                  disabled={!uploadFiles[gnome.id]}
                >
                  Submit Image
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <window.Components.PopularityGrid title="Gnome Popularity — Last 30 Days" showActive={true}/>

      {/* Celebration Modal */}
      {celebration && (
        <window.Components.CelebrationModal
          gnomeImage={celebration.gnomeImage}
          gnomeName={celebration.gnomeName}
          gnomeId={celebration.gnomeId}
          message={`You won Gnome #${celebration.gnomeId} ${celebration.gnomeName}! Upload a trigger image below.`}
          onClose={() => setCelebration(null)}
        />
      )}
    </div>
  );
}

/* =============================================================================
   ADMIN COMPONENT
============================================================================= */
function Admin({user}) {
  const [cost,setCost]=useState(window.__costPerUnlock||1);
  const [goldenDate,setGoldenDate]=useState("");
  const [goldenHours,setGoldenHours]=useState(2);
  const [goldenTarget,setGoldenTarget]=useState(1);
  const [goldenHint,setGoldenHint]=useState("Shines where the breeze carries laughter.");
  const [msg,setMsg]=useState("");
  const [cTitle,setCTitle]=useState("Admin: Free Drink");
  const [cDesc,setCDesc]=useState("Complimentary drink — one time.");
  const [cTarget,setCTarget]=useState("one");
  const [cGnome,setCGnome]=useState(1);
  const [cStart,setCStart]=useState("");
  const [cEnd,setCEnd]=useState("");
  const [cCap,setCCap]=useState(0);
  const [cActive,setCActive]=useState(true);

  function setCostPerUnlock(){
    window.__costPerUnlock = Number(cost)||0;
    setMsg("Updated advertiser cost-per-unlock.");
  }

  function scheduleGolden(){
    const start = goldenDate ? new Date(goldenDate).getTime() : Date.now();
    const end   = start + Math.max(1,Number(goldenHours)||1)*3600000;
    window.__goldenScheduled = { start,end,gnomeId:Number(goldenTarget)||1, hint: goldenHint };
    setMsg("Golden Gnome scheduled.");
  }

  function closeBidsAndAssignWinners(){
    window.GV.performAction(async () => {
      const newCelebrations = []; // Track celebrations for this cycle
      window.GV.GNOMES.forEach(g=>{
        let max=0, winner=null;
        for(const r of (window.__partnerBids||[])){ if(r.id===g.id && r.amt>max){ max=r.amt; winner=r.partnerId; } }
        const assign=window.__gnomeAssignments[g.id] || {partnerId:null,active:false,previousPartnerId:null};
        assign.previousPartnerId = assign.partnerId || null;
        assign.partnerId = winner || assign.partnerId;
        assign.active = false;
        window.__gnomeAssignments[g.id]=assign;
        if(winner && max>0){
          const p=(window.__partners||[]).find(x=>x.id===winner);
          if(p?.cardOnFile){
            window.__charges.push({type:'partner',partnerId:winner,amount:max,ts:Date.now(),note:`Winning bid for #${g.id}`});
          }
          // Create celebration event for the winning partner
          newCelebrations.push({
            partnerId: winner,
            gnomeId: g.id,
            gnomeName: g.name,
            gnomeImage: g.image,
            cycleId: window.__cycleId,
            ts: Date.now()
          });
        }
      });
      // Store all celebrations for partners to retrieve
      window.__partnerCelebrations.push(...newCelebrations);
      window.__partnerBids = [];
      window.__deviceCouponGrants = {};
      window.__cycleId = (window.__cycleId||1)+1;
      setMsg(`Bids closed, ${newCelebrations.length} winner(s) assigned, cycle advanced.`);
    }, "Bids Closed & Winners Assigned!");
  }

  function createAdminCoupon(){
    window.GV.performAction(async () => {
      const id='cp-'+Math.random().toString(36).slice(2,8);
      const s=cStart?new Date(cStart).getTime():undefined;
      const e=cEnd?new Date(cEnd).getTime():undefined;
      window.__coupons.push({
        id, system:true, advertiserId:undefined,
        title:cTitle, desc:cDesc, target:cTarget, gnomeId:cTarget==='one'?Number(cGnome):undefined,
        startAt:s, endAt:e, scanCap:Number(cCap)||0, unlocks:0, active:cActive, blocked:false
      });
      setMsg("Admin coupon created.");
    }, "Admin Coupon Created!");
  }

  function blockAdvertiser(a,flag){
    window.GV.performAction(async () => {
      a.blocked=flag;
      setMsg(`${flag?'Blocked':'Unblocked'} advertiser.`);
    }, flag ? "Advertiser Blocked!" : "Advertiser Unblocked!");
  }
  function blockCoupon(c,flag){
    window.GV.performAction(async () => {
      c.blocked=flag;
      setMsg(`${flag?'Blocked':'Unblocked'} coupon.`);
    }, flag ? "Coupon Blocked!" : "Coupon Unblocked!");
  }

  function approveSubmission(idx){
    window.GV.performAction(async () => {
      const item=(window.__submittedTriggers||[])[idx]; if(!item) return;
      window.__triggerImages[item.gnomeId]={ dataUrl:item.dataUrl, aHash:item.aHash };
      item.approved = true; // Mark as approved
      setMsg(`Approved trigger for #${item.gnomeId}.`);
    }, "Trigger Approved!");
  }
  function rejectSubmission(idx){
    window.GV.performAction(async () => {
      (window.__submittedTriggers||[]).splice(idx,1);
      setMsg("Submission rejected.");
    }, "Submission Rejected!");
  }
  function uploadDirectTrigger(gnomeId, file){
    window.GV.performAction(async () => {
      if(!file) return;
      return new Promise((resolve) => {
        const reader=new FileReader();
        reader.onload=async (e)=>{
          const dataUrl=e.target.result;
          try{
            const hash=await window.GV.aHashFromDataUrl(dataUrl);
            window.__triggerImages[gnomeId]={ dataUrl, aHash:hash };
            setMsg(`Trigger updated for #${gnomeId}.`);
            resolve();
          }catch(err){ setMsg("Failed to process image."); resolve(); }
        };
        reader.readAsDataURL(file);
      });
    }, "Trigger Updated!");
  }

  const coupons=window.__coupons||[];
  const advertisers=window.__advertisers||[];
  const submissions=window.__submittedTriggers||[];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border p-3 bg-white">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Admin Controls</h3>
          <div className="text-[11px] text-gray-600">Logged in: <span className="font-mono">{user?.email||'—'}</span></div>
        </div>
        <div className="text-xs grid md:grid-cols-3 gap-2">
          <label className="grid gap-1">Cost per unlock (advertiser)
            <input type="number" className="border rounded px-2 py-1" value={cost} onChange={e=>setCost(e.target.value)}/>
          </label>
          <div className="md:col-span-2 flex items-end">
            <button className="rounded bg-black text-white px-3 py-1.5 text-sm" onClick={setCostPerUnlock}>Update</button>
          </div>
        </div>
        {msg && <div className="mt-2 text-xs text-green-700">{msg}</div>}
      </div>

      <div className="rounded-2xl border p-3 bg-white">
        <h3 className="font-semibold text-sm mb-2">Golden Gnome Scheduler</h3>
        <div className="grid md:grid-cols-5 gap-2 text-xs">
          <label className="grid gap-1">Start
            <input type="datetime-local" className="border rounded px-2 py-1" value={goldenDate} onChange={e=>setGoldenDate(e.target.value)}/>
          </label>
          <label className="grid gap-1">Hours
            <input type="number" className="border rounded px-2 py-1" value={goldenHours} onChange={e=>setGoldenHours(e.target.value)}/>
          </label>
          <label className="grid gap-1">Target Gnome
            <input type="number" className="border rounded px-2 py-1" value={goldenTarget} onChange={e=>setGoldenTarget(e.target.value)}/>
          </label>
          <label className="grid gap-1 md:col-span-2">Hint
            <input className="border rounded px-2 py-1" value={goldenHint} onChange={e=>setGoldenHint(e.target.value)}/>
          </label>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <button className="rounded bg-black text-white px-3 py-1.5 text-sm" onClick={scheduleGolden}>Schedule</button>
          <button className="rounded border px-3 py-1.5 text-sm" onClick={closeBidsAndAssignWinners}>Close Bids & Assign Winners</button>
        </div>
      </div>

      <div className="rounded-2xl border p-3 bg-white">
        <h3 className="font-semibold text-sm mb-2">Trigger Images (scan-to-unlock)</h3>

        <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {window.GV.GNOMES.map(g=>{
            const trig=window.__triggerImages[g.id];
            return (
              <div key={g.id} className="rounded-xl border p-3">
                <div className="text-xs font-semibold mb-2 flex items-center gap-2">
                  <img src={g.image} className="w-5 h-5 object-contain" alt=""/>{`#${g.id} ${g.name}`}
                </div>
                <div className="text-[11px] text-gray-600 mb-1">{trig?'Current trigger:':'No trigger set'}</div>
                {trig && <img src={trig.dataUrl} alt="" className="w-full h-24 object-cover rounded border"/>}
                <label className="block mt-2 text-[11px]">Replace / Upload
                  <input type="file" accept="image/*" className="mt-1 text-xs" onChange={e=>uploadDirectTrigger(g.id, e.target.files?.[0])}/>
                </label>
              </div>
            );
          })}
        </div>

        <div className="mt-4">
          <h4 className="font-semibold text-sm mb-1">Pending Partner Submissions</h4>
          <div className="grid md:grid-cols-2 gap-2 text-xs">
            {submissions.length===0 && <div className="text-gray-500">No pending submissions.</div>}
            {submissions.map((s,idx)=>{
              const p=(window.__partners||[]).find(pp=>pp.id===s.partnerId);
              return (
                <div key={idx} className="rounded border p-2">
                  <div className="flex items-center gap-2">
                    <div className="font-semibold">#{s.gnomeId} by {p?.establishment||p?.name||s.partnerId}</div>
                    <div className="ml-auto text-[11px]">{new Date(s.ts).toLocaleString()}</div>
                  </div>
                  <img src={s.dataUrl} alt="" className="w-full h-28 object-cover rounded border mt-1"/>
                  <div className="mt-2 flex items-center gap-2">
                    <button className="rounded bg-black text-white px-2 py-1" onClick={()=>approveSubmission(idx)}>Approve</button>
                    <button className="rounded border px-2 py-1" onClick={()=>rejectSubmission(idx)}>Reject</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* QR Codes Section */}
      <div className="rounded-2xl border p-3 bg-white">
        <h3 className="font-semibold text-sm mb-2">QR Codes for Posters</h3>
        <p className="text-xs text-gray-600 mb-3">
          Print these QR codes on posters. When participants scan them, they'll see dynamic clues that update automatically when you approve new trigger images from partners.
        </p>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {window.GV.GNOMES.map(g=>{
            const qrData = window.GV.qrDataFor(g.id);
            const pngUrl = window.GV.qrPngUrl(qrData, 200);
            const svgUrl = window.GV.qrSvgUrl(qrData, 200);
            return (
              <div key={g.id} className="rounded-xl border p-3 text-center">
                <div className="text-xs font-semibold mb-2 flex items-center gap-2 justify-center">
                  <img src={g.image} className="w-5 h-5 object-contain" alt=""/>{`#${g.id} ${g.name}`}
                </div>
                <img src={pngUrl} alt={`QR ${g.id}`} className="w-full h-auto rounded border mb-2"/>
                <div className="flex flex-col gap-1">
                  <a href={pngUrl} download={`gnome-${g.id}-qr.png`} className="text-xs text-blue-600 hover:underline">Download PNG</a>
                  <button 
                    className="text-xs bg-black text-white rounded px-2 py-1 hover:bg-gray-800"
                    onClick={()=>window.GV.downloadSvg(svgUrl, `gnome-${g.id}-qr.svg`)}
                  >
                    Download SVG
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border p-3 bg-white">
        <h3 className="font-semibold text-sm mb-2">Create Admin Coupons (no card required)</h3>
        <div className="grid md:grid-cols-4 gap-2 text-xs">
          <label className="grid gap-1">Title<input className="border rounded px-2 py-1" value={cTitle} onChange={e=>setCTitle(e.target.value)}/></label>
          <label className="grid gap-1 md:col-span-2">Description<input className="border rounded px-2 py-1" value={cDesc} onChange={e=>setCDesc(e.target.value)}/></label>
          <label className="grid gap-1">Target
            <select className="border rounded px-2 py-1" value={cTarget} onChange={e=>setCTarget(e.target.value)}>
              <option value="one">Specific gnome</option>
              <option value="all">All gnomes</option>
              <option value="golden">Golden gnome</option>
            </select>
          </label>
          {cTarget==='one' && <label className="grid gap-1">Gnome ID
            <input type="number" className="border rounded px-2 py-1" value={cGnome} onChange={e=>setCGnome(e.target.value)}/>
          </label>}
          <label className="grid gap-1">Start
            <input type="datetime-local" className="border rounded px-2 py-1" value={cStart} onChange={e=>setCStart(e.target.value)}/>
          </label>
          <label className="grid gap-1">End
            <input type="datetime-local" className="border rounded px-2 py-1" value={cEnd} onChange={e=>setCEnd(e.target.value)}/>
          </label>
          <label className="grid gap-1">Scan cap
            <input type="number" className="border rounded px-2 py-1" value={cCap} onChange={e=>setCCap(e.target.value)}/>
          </label>
          <label className="flex items-center gap-2 mt-5"><input type="checkbox" checked={cActive} onChange={e=>setCActive(e.target.checked)}/> Active</label>
          <div className="md:col-span-4">
            <button className="rounded bg-black text-white px-3 py-1.5 text-sm" onClick={createAdminCoupon}>Create Coupon</button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border p-3 bg-white">
        <h3 className="font-semibold text-sm mb-2">Moderation</h3>
        <div className="grid md:grid-cols-2 gap-2 text-xs">
          <div className="rounded border p-2">
            <div className="font-semibold mb-1">Advertisers</div>
            {advertisers.length===0 && <div className="text-gray-500">None</div>}
            {advertisers.map(a=>(
              <div key={a.id} className="border rounded p-2 mb-1">
                <div className="flex items-center gap-2">
                  <div className="font-semibold">{a.name||a.email}</div>
                  <span className="ml-auto text-[11px]">{a.blocked?<span className="px-2 py-0.5 rounded-full border bg-red-50 border-red-500">Blocked</span>:<span className="px-2 py-0.5 rounded-full border bg-green-50 border-green-500">OK</span>}</span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <button className="rounded border px-2 py-1" onClick={()=>blockAdvertiser(a,false)}>Unblock</button>
                  <button className="rounded border px-2 py-1" onClick={()=>blockAdvertiser(a,true)}>Block</button>
                </div>
              </div>
            ))}
          </div>
          <div className="rounded border p-2">
            <div className="font-semibold mb-1">Coupons</div>
            {coupons.length===0 && <div className="text-gray-500">None</div>}
            {coupons.map(c=>(
              <div key={c.id} className="border rounded p-2 mb-1">
                <div className="flex items-center gap-2">
                  <div className="font-semibold">{c.title}</div>
                  <span className="ml-auto"><window.Components.ActiveBadge active={c.active && !c.blocked}/></span>
                </div>
                <div className="text-[11px] text-gray-600">{c.desc}</div>
                <div className="text-[11px]">Target: <span className="font-mono">{c.target}{c.target==='one'?` #${c.gnomeId}`:''}</span> {c.system?`(admin)`:`(advertiser)`}</div>
                <div className="mt-1 flex items-center gap-2">
                  <button className="rounded border px-2 py-1" onClick={()=>blockCoupon(c,false)}>Unblock</button>
                  <button className="rounded border px-2 py-1" onClick={()=>blockCoupon(c,true)}>Block</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <window.Components.PopularityGrid title="Gnome Popularity — 30d with Active/Inactive" showActive={true}/>
    </div>
  );
}

/* =============================================================================
   TABS
============================================================================= */
function Tabs({tab,setTab,role}) {
  const btn=(k,label)=>(
    <button onClick={()=>setTab(k)} className={`px-3 py-1.5 rounded-full border text-sm ${tab===k?'bg-black text-white':'bg-white hover:bg-gray-50'}`}>{label}</button>
  );
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {(role==='participant') && btn('participant','Participant')}
      {(role==='advertiser') && btn('advertiser','Advertiser')}
      {(role==='partners') && btn('partners','Partners')}
      {(role==='admin') && <>
        {btn('participant','Participant')}
        {btn('advertiser','Advertiser')}
        {btn('partners','Partners')}
        {btn('admin','Admin')}
      </>}
    </div>
  );
}

/* =============================================================================
   MAIN APP
============================================================================= */
export default function App(){
  const role=window.GV.roleFromHost();
  const [user,setUser]=useState(window.GV.loadUser());
  const [tab,setTab]=useState(role==='participant'?'participant':role);
  const [needSignup,setNeedSignup]=useState(!user?.profileComplete);
  const [, forceUpdate] = useState({});

  // Subscribe to action state changes
  useEffect(() => {
    const handler = () => forceUpdate({});
    window.GV.actionHandlers.push(handler);
    return () => {
      const idx = window.GV.actionHandlers.indexOf(handler);
      if (idx > -1) window.GV.actionHandlers.splice(idx, 1);
    };
  }, []);

  function finishSignup(profile){
    if(profile){ setUser(profile); }
    setNeedSignup(false);
  }

  return (
    <div className="min-h-screen">
      <GlobalFX />
      
      {/* Loading Bar */}
      {window.GV.actionState.loading && <window.Components.LoadingBar />}
      
      {/* Success Notification */}
      {window.GV.actionState.success && (
        <window.Components.SuccessNotification 
          message={window.GV.actionState.successMessage || "Success!"} 
          onClose={() => {}}
        />
      )}

      <header className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl md:text-3xl font-black flex items-center gap-2">
            <img src="https://raw.githubusercontent.com/promos-cmyk/legendary-octo-broccoli/main/wildflower-favicon.png" alt="Wildflower" className="w-28 h-28 object-contain float-gnome"/>
            <span>WildFlower Gnomeville</span>
          </h1>
          <Tabs tab={tab} setTab={setTab} role={role}/>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 pb-10">
        {(role==='participant' || role==='admin') && tab==='participant' && <Participant user={user}/>}
        {(role==='advertiser' || role==='admin') && tab==='advertiser' && <Advertiser user={user}/>}
        {(role==='partners' || role==='admin') && tab==='partners' && <Partners user={user}/>}
        {role==='admin' && tab==='admin' && <Admin user={user}/>}
      </main>

      <footer className="max-w-6xl mx-auto px-4 pb-8 text-[11px] text-gray-500">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <span>© {new Date().getFullYear()} WildFlower FL</span>
          <span>gnomeville.app • participants | partners.gnomeville.app • partners | advertisers.gnomeville.app • advertisers | admin.gnomeville.app • admin</span>
        </div>
      </footer>

      {needSignup && <window.Components.SignupModal role={role} onDone={finishSignup}/>}
    </div>
  );
}
