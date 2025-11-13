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
if(!window.__advertisers) window.__advertisers=[{id:"adv-1",name:"Demo Advertiser",cardOnFile:true,blocked:false,freeAdvertising:false}];
if(!window.__gnomeAssignments) window.__gnomeAssignments=Object.fromEntries(window.GV.GNOMES.map(g=>[g.id,{partnerId:null,active:false,previousPartnerId:null}]));
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

/* NEW: Auction mode toggle - when false, partners select gnomes directly without bidding */
if(window.__auctionEnabled === undefined) window.__auctionEnabled = true;

/* NEW: Cycle timing - 30 days per cycle */
if(!window.__cycleStartTime) window.__cycleStartTime = Date.now();
if(!window.__cycleDuration) window.__cycleDuration = 30 * 24 * 60 * 60 * 1000; // 30 days in ms

/* NEW: Shared map - track active participants */
if(!window.__activeParticipants) window.__activeParticipants = {};

/* NEW: Trigger image stores - images are auto-active, admin can block them */
if(!window.__triggerImages) window.__triggerImages = {}; // {gnomeId: {dataUrl, aHash, partnerId, blocked, ts}}

/* NEW: Celebration events for partner wins & advertiser unlocks */
if(!window.__partnerCelebrations) window.__partnerCelebrations = [];
if(!window.__advertiserUnlockEvents) window.__advertiserUnlockEvents = [];

/* NEW: Cycle pending state - set to true when admin closes bids, false when activated */
if(window.__cyclePending === undefined) window.__cyclePending = false;

/* NEW: AI-generated riddles for each gnome based on trigger images */
if(!window.__gnomeRiddles) window.__gnomeRiddles = {};

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

/* ---------- Cycle timing utilities ---------- */
window.GV.getCycleTimeRemaining = function() {
  const elapsed = Date.now() - window.__cycleStartTime;
  const remaining = window.__cycleDuration - elapsed;
  return Math.max(0, remaining);
};

window.GV.formatTimeRemaining = function(ms) {
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  return `${days}d ${hours}h ${minutes}m`;
};

window.GV.checkAndAutoCloseCycle = function() {
  if (window.GV.getCycleTimeRemaining() === 0) {
    // Auto-close bids and assign winners
    window.GV.autoCloseBids();
  }
};

window.GV.autoCloseBids = function() {
  const newCelebrations = [];
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
  window.__partnerCelebrations.push(...newCelebrations);
  window.__partnerBids = [];
  window.__deviceCouponGrants = {};
  window.__cycleId = (window.__cycleId||1)+1;
  window.__cycleStartTime = Date.now(); // Reset cycle timer
};

// Check for auto-close every minute
setInterval(() => window.GV.checkAndAutoCloseCycle(), 60000);

/* ---------- Shared map utilities ---------- */
window.GV.updateParticipantLocation = function(deviceId, lat, lng, gender) {
  window.__activeParticipants[deviceId] = {
    lat, lng, gender,
    lastUpdate: Date.now()
  };
};

window.GV.getActiveParticipants = function() {
  const now = Date.now();
  const fiveMinutesAgo = now - 5 * 60 * 1000;
  // Remove stale participants (inactive for 5+ minutes)
  Object.keys(window.__activeParticipants).forEach(id => {
    if (window.__activeParticipants[id].lastUpdate < fiveMinutesAgo) {
      delete window.__activeParticipants[id];
    }
  });
  return window.__activeParticipants;
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

/* ---------- Cycle Countdown Component ---------- */
window.Components.CycleCountdown = function() {
  const [timeRemaining, setTimeRemaining] = useState(window.GV.getCycleTimeRemaining());

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = window.GV.getCycleTimeRemaining();
      setTimeRemaining(remaining);
      if (remaining === 0) {
        window.GV.checkAndAutoCloseCycle();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200">
      <span className="text-xs font-semibold text-blue-900">⏱️ Cycle ends in:</span>
      <span className="text-xs font-mono text-blue-700">{window.GV.formatTimeRemaining(timeRemaining)}</span>
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
// Updated to use dynamic URLs instead of GNOME:X format
window.GV.qrDataFor = (gnomeId)=> {
  const baseUrl = window.location.origin;
  return `${baseUrl}/gnome/${gnomeId}`;
};
window.GV.qrPngUrl  = (data, size=160)=> `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;
window.GV.qrSvgUrl  = (data, size=180)=> `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&format=svg&data=${encodeURIComponent(data)}`;

/* ---------- Image Auto-Crop for Optimal Scanning ---------- */
window.GV.autoCropImage = function(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // Target size optimized for mobile scanning (square format works best)
      const targetSize = 800;
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Calculate crop to square (centered)
      const size = Math.min(img.width, img.height);
      const x = (img.width - size) / 2;
      const y = (img.height - size) / 2;
      
      // Set canvas to target size
      canvas.width = targetSize;
      canvas.height = targetSize;
      
      // Draw cropped and resized image
      ctx.drawImage(img, x, y, size, size, 0, 0, targetSize, targetSize);
      
      // Convert to data URL with quality optimization
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
};

/* ---------- AI Riddle Generator ---------- */
window.GV.generateRiddle = function(gnomeId, triggerImageUrl) {
  // Simple pattern-based riddle generation based on gnome type and image context
  const gnome = window.GV.GNOMES.find(g => g.id === gnomeId);
  if (!gnome) return "Seek the hidden treasure where adventure awaits...";
  
  const riddles = {
    Surfer: [
      "Where waves crash and boards glide, seek the one who rides the tide.",
      "Find me where the ocean roars, and surfboards line the sandy shores.",
      "I hang ten where the surf meets land, with salty air and golden sand."
    ],
    Bartender: [
      "Where drinks are poured and stories told, a secret waits for the bold.",
      "Behind the bar where glasses clink, find the clue before you blink.",
      "I mix and shake from dusk till dawn, seek me where good times are drawn."
    ],
    Fisherman: [
      "Where lines are cast and fish do bite, I guard a secret out of sight.",
      "By the dock where boats do rest, find the clue that leads your quest.",
      "With rod and reel I wait for thee, near the waters of the sea."
    ],
    Ninja: [
      "In shadows deep where stealth prevails, seek the warrior of ancient tales.",
      "Silent as night, swift as wind, find where the ninja's path begins.",
      "Where honor meets the blade so keen, a hidden clue waits unseen."
    ],
    Musician: [
      "Where melodies fill the air, and rhythms dance without a care.",
      "Find me where the music plays, and joy resounds through all the days.",
      "I strum and sing for all to hear, the treasure hunt will lead you here."
    ],
    Lifeguard: [
      "I watch the shores from my high seat, where sun and safety always meet.",
      "By the waves where swimmers play, find the clue that lights your way.",
      "With whistle sharp and watchful eye, beneath the clear and cloudless sky."
    ],
    Party: [
      "Where celebration never ends, and laughter echoes among friends.",
      "Find me where the good times roll, and festive spirits fill the soul.",
      "I dance and cheer both night and day, the clue awaits where people play."
    ],
    Yoga: [
      "Where peace and balance find their place, seek tranquility and grace.",
      "In quiet calm where spirits soar, find the clue through mindful lore.",
      "I stretch and breathe in zen delight, the path ahead is clear and bright."
    ],
    Firefighter: [
      "Where heroes stand against the blaze, I guard the clue through smoky haze.",
      "With courage strong and heart so true, find where the brave protect the crew.",
      "I fight the flames both night and day, seek me where the engines stay."
    ],
    "Tattoo Artist": [
      "Where ink and art become as one, find the clue when day is done.",
      "I draw your dreams upon your skin, the treasure hunt waits deep within.",
      "With needle sharp and steady hand, seek the art across the land."
    ]
  };
  
  const gnomeRiddles = riddles[gnome.name] || ["Seek and you shall find..."];
  const riddle = gnomeRiddles[Math.floor(Math.random() * gnomeRiddles.length)];
  
  return riddle;
};

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

/* ---------- Universal Discover Page (Location-Based Gnome Finder) ---------- */
window.Components.DiscoverPage = function() {
  const [location, setLocation] = useState(null);
  const [nearestGnome, setNearestGnome] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showPending, setShowPending] = useState(false);

  // Check if any gnomes are active on mount
  useEffect(() => {
    const hasActiveGnomes = window.GV.GNOMES.some(g => {
      const assignment = window.__gnomeAssignments[g.id];
      return assignment?.active && assignment?.partnerId;
    });
    
    if (!hasActiveGnomes) {
      setShowPending(true);
      // Trigger celebration rain immediately
      setTimeout(() => window.GV.celebrateRain?.(), 300);
    }
  }, []);

  function requestLocation() {
    setLoading(true);
    setError(null);
    setShowPending(false);
    
    if (!navigator.geolocation) {
      // Check if no active gnomes - show pending instead of error
      const hasActiveGnomes = window.GV.GNOMES.some(g => {
        const assignment = window.__gnomeAssignments[g.id];
        return assignment?.active && assignment?.partnerId;
      });
      
      if (!hasActiveGnomes) {
        setShowPending(true);
        setLoading(false);
        setTimeout(() => window.GV.celebrateRain?.(), 300);
        return;
      }
      
      setError("Geolocation is not supported by your browser");
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;
        setLocation({ lat: userLat, lng: userLng });
        
        // Find nearest active gnome
        let minDistance = Infinity;
        let nearest = null;
        
        window.GV.GNOMES.forEach(g => {
          const assignment = window.__gnomeAssignments[g.id];
          if (!assignment?.active || !assignment?.partnerId) return;
          
          const partner = window.__partners.find(p => p.id === assignment.partnerId);
          if (!partner) return;
          
          const gnomeLocation = window.GV.addrToLatLng(partner.address);
          const distance = Math.sqrt(
            Math.pow(userLat - gnomeLocation.lat, 2) + 
            Math.pow(userLng - gnomeLocation.lng, 2)
          );
          
          if (distance < minDistance) {
            minDistance = distance;
            nearest = {
              gnome: g,
              partner,
              distance,
              location: gnomeLocation
            };
          }
        });
        
        setNearestGnome(nearest);
        setLoading(false);
        
        if (nearest) {
          setShowCelebration(true);
          // Trigger coin/nug rain
          setTimeout(() => window.GV.celebrateRain?.(), 300);
        } else {
          // No active gnomes found - show pending
          setShowPending(true);
          setTimeout(() => window.GV.celebrateRain?.(), 300);
        }
      },
      (err) => {
        // Check if no active gnomes - show pending instead of error
        const hasActiveGnomes = window.GV.GNOMES.some(g => {
          const assignment = window.__gnomeAssignments[g.id];
          return assignment?.active && assignment?.partnerId;
        });
        
        if (!hasActiveGnomes) {
          setShowPending(true);
          setLoading(false);
          setTimeout(() => window.GV.celebrateRain?.(), 300);
          return;
        }
        
        setError("Unable to retrieve your location. Please enable location services.");
        setLoading(false);
      }
    );
  }

  // Show pending state if no active gnomes
  if (showPending) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="rounded-2xl border-2 border-yellow-400 bg-gradient-to-br from-yellow-50 to-orange-50 p-8 text-center relative overflow-hidden">
          <div className="mb-6">
            <h1 className="text-3xl font-black text-orange-900 mb-2">
              🌸 WildFlower Gnomeville<br/>Scavenger Hunt!
            </h1>
            <div className="inline-block bg-yellow-400 text-yellow-900 font-black px-6 py-2 rounded-full text-xl border-2 border-yellow-600 shadow-lg">
              Status: PENDING
            </div>
          </div>
          
          {/* All gnomes dancing */}
          <div className="grid grid-cols-5 gap-3 mb-6">
            {window.GV.GNOMES.map(g => (
              <div key={g.id} className="flex flex-col items-center">
                <img 
                  src={g.image} 
                  alt={g.name} 
                  className="w-16 h-16 float-gnome"
                />
                <span className="text-xs font-semibold text-gray-700 mt-1">#{g.id}</span>
              </div>
            ))}
          </div>
          
          <div className="bg-white rounded-xl p-4 mb-4 border-2 border-orange-300">
            <p className="text-gray-800 text-sm mb-2">
              🎮 <strong>The hunt hasn't started yet!</strong>
            </p>
            <p className="text-gray-700 text-xs">
              Our partner restaurants are currently setting up their gnome locations. 
              Check back soon to start your treasure hunt adventure!
            </p>
          </div>
          
          <button 
            onClick={() => window.location.href = '/?enableMap=true'}
            className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-6 rounded-full text-sm transition-all active:scale-95"
          >
            🗺️ Go to Participant Map
          </button>
        </div>
      </div>
    );
  }

  if (!location && !loading && !error) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="rounded-2xl border-2 border-blue-400 bg-gradient-to-br from-blue-50 to-cyan-50 p-8 text-center">
          <div className="mb-6">
            <span className="text-6xl">📍</span>
          </div>
          <h1 className="text-3xl font-black text-blue-900 mb-4">Discover Your Nearest Gnome!</h1>
          <p className="text-gray-700 mb-6">
            Enable location services to find the hidden gnome closest to you and unlock exclusive clues and rewards!
          </p>
          <button 
            onClick={requestLocation}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-full text-lg transition-all active:scale-95"
          >
            🎯 Enable Location & Discover
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center">
        <div className="rounded-2xl border bg-white p-8">
          <div className="animate-spin text-6xl mb-4">🧭</div>
          <p className="text-gray-700">Finding your nearest gnome...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="rounded-2xl border-2 border-red-400 bg-red-50 p-8 text-center">
          <span className="text-6xl mb-4 block">⚠️</span>
          <h2 className="text-2xl font-bold text-red-900 mb-4">Location Required</h2>
          <p className="text-red-700 mb-6">{error}</p>
          <button 
            onClick={requestLocation}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-full transition-all active:scale-95"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!nearestGnome) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="rounded-2xl border bg-white p-8 text-center">
          <span className="text-6xl mb-4 block">🔍</span>
          <h2 className="text-2xl font-bold text-gray-700 mb-4">No Active Gnomes Nearby</h2>
          <p className="text-gray-600">Check back soon for new gnome locations!</p>
        </div>
      </div>
    );
  }

  const { gnome, partner } = nearestGnome;
  
  // Get riddle
  let riddle = window.__gnomeRiddles[gnome.id];
  if (!riddle) {
    const triggerImg = window.__triggerImages[gnome.id];
    riddle = window.GV.generateRiddle(gnome.id, triggerImg?.dataUrl);
    window.__gnomeRiddles[gnome.id] = riddle;
  }

  // Get partner hints
  const partnerHints = (window.__partnerHints || [])
    .filter(h => h.gnomeId === gnome.id)
    .sort((a, b) => b.ts - a.ts);

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="rounded-2xl border-2 border-green-400 bg-gradient-to-br from-green-50 to-emerald-50 p-8 relative overflow-hidden">
        {/* Dancing Gnome */}
        <div className="text-center mb-6">
          <img 
            src={gnome.image} 
            alt={gnome.name} 
            className="w-40 h-40 mx-auto mb-4 float-gnome"
          />
          <h1 className="text-3xl font-black text-green-900 mb-2">
            You Found #{gnome.id} {gnome.name} Gnome!
          </h1>
          <p className="text-sm text-green-700">
            📍 Hidden at: <strong>{partner.establishment}</strong>
          </p>
          <p className="text-xs text-gray-600">{partner.address}</p>
        </div>

        {/* AI-Generated Riddle */}
        <div className="bg-white rounded-xl p-6 mb-4 border-2 border-blue-300 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="text-3xl">🔮</span>
            <div className="flex-1">
              <h3 className="font-bold text-blue-900 mb-2">Mystical Riddle</h3>
              <p className="text-gray-800 italic leading-relaxed">"{riddle}"</p>
            </div>
          </div>
        </div>

        {/* Partner Hints */}
        {partnerHints.length > 0 && (
          <div className="bg-white rounded-xl p-6 mb-4 border-2 border-purple-300 shadow-sm">
            <div className="flex items-start gap-3 mb-3">
              <span className="text-3xl">💡</span>
              <h3 className="font-bold text-purple-900">Partner Clues</h3>
            </div>
            <div className="space-y-3">
              {partnerHints.slice(0, 3).map((hint, idx) => (
                <div key={idx} className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                  <p className="text-gray-800">{hint.text}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(hint.ts).toLocaleDateString()} at {new Date(hint.ts).toLocaleTimeString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Call to Action */}
        <div className="bg-gradient-to-r from-yellow-400 to-orange-400 rounded-xl p-6 text-center shadow-lg">
          <h3 className="text-2xl font-black text-white mb-3">🎮 Ready to Play?</h3>
          <p className="text-white mb-4">
            Scan the trigger image at this location to unlock rewards!
          </p>
          <a 
            href="/?enableMap=true"
            className="inline-block bg-white text-orange-600 font-bold py-3 px-8 rounded-full text-lg transition-all hover:bg-gray-100 active:scale-95 shadow-lg"
          >
            🗺️ Open Participant Map
          </a>
        </div>
      </div>
    </div>
  );
};

/* ---------- Dynamic Gnome Clue Landing Page ---------- */
window.Components.GnomeClue = function({ gnomeId }) {
  const gnome = window.GV.GNOMES.find(g => g.id === gnomeId);
  
  if (!gnome) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center">
        <p className="text-lg text-gray-600">Gnome not found.</p>
      </div>
    );
  }

  // Check if cycle is pending (admin closed bids but not yet activated)
  if (window.__cyclePending) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="rounded-2xl border-2 border-purple-400 bg-gradient-to-br from-purple-50 to-pink-50 p-8 text-center">
          <h2 className="text-2xl font-black mb-6 text-purple-900">🎉 Game Cycle Complete! 🎉</h2>
          
          {/* All 10 gnomes dancing */}
          <div className="grid grid-cols-5 gap-4 mb-6">
            {window.GV.GNOMES.map(g => (
              <div key={g.id} className="flex flex-col items-center">
                <img 
                  src={g.image} 
                  alt={g.name} 
                  className="w-16 h-16 float-gnome"
                />
                <span className="text-xs mt-1">{g.name}</span>
              </div>
            ))}
          </div>
          
          <div className="bg-white rounded-xl p-6 border-2 border-purple-300">
            <p className="text-xl font-bold text-purple-900 mb-3">⏳ Pending New Game Setup</p>
            <p className="text-gray-700 mb-2">
              Our partners are preparing exciting new locations and clues for the next cycle!
            </p>
            <p className="text-sm text-gray-600">
              Check back soon to continue your treasure hunt adventure.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Get gnome assignment and check if active
  const assignment = window.__gnomeAssignments[gnomeId];
  const partner = window.__partners.find(p => p.id === assignment?.partnerId);
  
  if (!assignment?.active || !partner) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="rounded-2xl border bg-white p-8 text-center">
          <img src={gnome.image} alt={gnome.name} className="w-32 h-32 mx-auto mb-4 float-gnome-sm opacity-50" />
          <h2 className="text-xl font-bold text-gray-400 mb-2">#{gnomeId} {gnome.name} Gnome</h2>
          <p className="text-gray-500">This gnome is not currently active in the game.</p>
        </div>
      </div>
    );
  }

  // Get or generate riddle
  let riddle = window.__gnomeRiddles[gnomeId];
  if (!riddle) {
    const triggerImg = window.__triggerImages[gnomeId];
    riddle = window.GV.generateRiddle(gnomeId, triggerImg?.dataUrl);
    window.__gnomeRiddles[gnomeId] = riddle;
  }

  // Get partner hints
  const partnerHints = (window.__partnerHints || [])
    .filter(h => h.gnomeId === gnomeId)
    .sort((a, b) => b.ts - a.ts);

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="rounded-2xl border-2 border-blue-400 bg-gradient-to-br from-blue-50 to-cyan-50 p-8">
        {/* Gnome Header */}
        <div className="text-center mb-6">
          <img 
            src={gnome.image} 
            alt={gnome.name} 
            className="w-32 h-32 mx-auto mb-4 float-gnome"
          />
          <h1 className="text-3xl font-black text-blue-900 mb-2">
            #{gnomeId} {gnome.name} Gnome
          </h1>
          <p className="text-sm text-blue-700">
            Hidden at: <strong>{partner.establishment}</strong>
          </p>
        </div>

        {/* AI-Generated Riddle */}
        <div className="bg-white rounded-xl p-6 mb-4 border-2 border-blue-300 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="text-3xl">🔮</span>
            <div className="flex-1">
              <h3 className="font-bold text-blue-900 mb-2">Mystical Riddle</h3>
              <p className="text-gray-800 italic leading-relaxed">
                "{riddle}"
              </p>
            </div>
          </div>
        </div>

        {/* Partner Hints (if any) */}
        {partnerHints.length > 0 && (
          <div className="bg-white rounded-xl p-6 border-2 border-green-300 shadow-sm">
            <div className="flex items-start gap-3 mb-3">
              <span className="text-3xl">💡</span>
              <h3 className="font-bold text-green-900">Partner Clues</h3>
            </div>
            <div className="space-y-3">
              {partnerHints.map((hint, idx) => (
                <div key={idx} className="bg-green-50 rounded-lg p-3 border border-green-200">
                  <p className="text-gray-800">{hint.text}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(hint.ts).toLocaleDateString()} at {new Date(hint.ts).toLocaleTimeString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-6 bg-yellow-50 rounded-xl p-4 border border-yellow-300">
          <p className="text-sm text-yellow-900">
            <strong>🎯 Next Steps:</strong> Use the Gnomeville app's <strong>Image Unlock</strong> feature to scan the trigger image at this location and claim your rewards!
          </p>
        </div>
      </div>
    </div>
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
  const [, forceUpdate] = useState({});
  const [assignmentsHash, setAssignmentsHash] = useState('');
  const [hintsHash, setHintsHash] = useState('');

  const videoRef=useRef(null), canvasRef=useRef(null), loopRef=useRef(null), streamRef=useRef(null);
  const mapRef=useRef(null), meMarkerRef=useRef(null);
  const watchIdRef=useRef(null);
  const gnomeMarkersRef=useRef({}); // Track gnome markers separately

  // Poll for gnome assignments, hints, and trigger images every 2 seconds
  useEffect(() => {
    const checkForChanges = () => {
      let changed = false;
      
      // Check gnome assignments (locations, active status)
      const newAssignmentsHash = JSON.stringify(
        Object.entries(window.__gnomeAssignments || {})
          .map(([id, a]) => `${id}:${a.partnerId}:${a.active}`)
          .sort()
      );
      
      if (newAssignmentsHash !== assignmentsHash) {
        setAssignmentsHash(newAssignmentsHash);
        changed = true;
        
        // Refresh map markers if map is enabled
        if (mapOn && mapRef.current) {
          refreshGnomeMarkers();
        }
      }
      
      // Check partner hints
      const activeHints = (window.__partnerHints || []).filter(h => {
        return !h.expiresAt || h.expiresAt > Date.now();
      });
      const newHintsHash = JSON.stringify(
        activeHints.map(h => `${h.gnomeId}:${h.text}:${h.ts}`).sort()
      );
      
      if (newHintsHash !== hintsHash) {
        setHintsHash(newHintsHash);
        changed = true;
        
        // Refresh marker popups if map is enabled (hints changed)
        if (mapOn && mapRef.current) {
          refreshGnomeMarkers();
        }
      }
      
      if (changed) {
        forceUpdate({});
      }
    };
    
    const interval = setInterval(checkForChanges, 2000);
    
    // Also check on window focus (when switching tabs)
    const handleFocus = () => {
      checkForChanges();
    };
    window.addEventListener('focus', handleFocus);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [assignmentsHash, hintsHash, mapOn]);

  // Auto-enable map if coming from discovery page
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('enableMap') === 'true' && !mapOn) {
      setTimeout(() => {
        setMapOn(true);
        setTimeout(() => enableMap(), 100);
      }, 500);
    }
  }, []);

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
  const [participantMarkers, setParticipantMarkers] = useState({});

  function initMap(){
    if(mapRef.current) return;
    const map=window.L.map('map').setView([27.977,-82.832],13);
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
    mapRef.current=map;
    
    // Add gnome markers using the shared function
    window.GV.GNOMES.forEach(g=>{
      const a=window.__gnomeAssignments[g.id]; if(!(a&&a.active)) return;
      const p=(window.__partners||[]).find(pp=>pp.id===a.partnerId);
      if(!p) return;
      
      const {lat,lng}=window.GV.addrToLatLng(p.address||''); 
      const icon=window.L.icon({iconUrl:g.image,iconSize:[40,40],iconAnchor:[20,20]});
      const m=window.L.marker([lat,lng],{icon}).addTo(map);
      const riddle=riddleForPartner(p); const hint=activePartnerHintFor(g.id)?.text || '';
      const url=`https://maps.apple.com/?daddr=${lat},${lng}`;
      m.bindPopup(`<div style="min-width:180px"><strong>#${g.id} ${g.name}</strong><div style="margin-top:4px;font-size:12px"><em>${riddle}</em></div>${hint?`<div style="margin-top:4px;font-size:12px">Hint: ${hint}</div>`:''}<div style="margin-top:6px"><a href="${url}" target="_blank" rel="noopener">Get Directions</a></div></div>`);
      
      gnomeMarkersRef.current[g.id] = m;
    });
  }

  // Sync other participants on map
  function syncParticipantsOnMap(){
    if(!mapRef.current) return;
    const activeParticipants = window.GV.getActiveParticipants();
    const newMarkers = {};
    
    Object.entries(activeParticipants).forEach(([deviceId, data]) => {
      if(deviceId === window.GV.DEVICE_ID) return; // Skip self
      const color = data.gender === "male" ? "#2563eb" : data.gender === "female" ? "#ec4899" : "#eab308";
      const icon = window.L.divIcon({
        className: '',
        html: `<div style="width:12px;height:12px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 0 0 1px rgba(0,0,0,.2);opacity:0.7"></div>`
      });
      
      if(participantMarkers[deviceId]){
        participantMarkers[deviceId].setLatLng([data.lat, data.lng]);
        newMarkers[deviceId] = participantMarkers[deviceId];
      } else {
        newMarkers[deviceId] = window.L.marker([data.lat, data.lng], {icon}).addTo(mapRef.current);
      }
    });
    
    // Remove markers for inactive participants
    Object.keys(participantMarkers).forEach(deviceId => {
      if(!newMarkers[deviceId] && participantMarkers[deviceId]){
        mapRef.current.removeLayer(participantMarkers[deviceId]);
      }
    });
    
    setParticipantMarkers(newMarkers);
  }

  function refreshGnomeMarkers(){
    if(!mapRef.current) return;
    
    // Remove all existing gnome markers
    Object.values(gnomeMarkersRef.current).forEach(marker => {
      if(marker) mapRef.current.removeLayer(marker);
    });
    gnomeMarkersRef.current = {};
    
    // Re-add gnome markers with updated data
    window.GV.GNOMES.forEach(g=>{
      const a=window.__gnomeAssignments[g.id]; 
      if(!(a&&a.active)) return;
      const p=(window.__partners||[]).find(pp=>pp.id===a.partnerId);
      if(!p) return;
      
      const {lat,lng}=window.GV.addrToLatLng(p.address||''); 
      const icon=window.L.icon({iconUrl:g.image,iconSize:[40,40],iconAnchor:[20,20]});
      const m=window.L.marker([lat,lng],{icon}).addTo(mapRef.current);
      
      const riddle=riddleForPartner(p); 
      const hint=activePartnerHintFor(g.id)?.text || '';
      const url=`https://maps.apple.com/?daddr=${lat},${lng}`;
      m.bindPopup(`<div style="min-width:180px"><strong>#${g.id} ${g.name}</strong><div style="margin-top:4px;font-size:12px"><em>${riddle}</em></div>${hint?`<div style="margin-top:4px;font-size:12px">Hint: ${hint}</div>`:''}<div style="margin-top:6px"><a href="${url}" target="_blank" rel="noopener">Get Directions</a></div></div>`);
      
      gnomeMarkersRef.current[g.id] = m;
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
        
        // Update shared location
        window.GV.updateParticipantLocation(window.GV.DEVICE_ID, latitude, longitude, gender);
        
        // Only center map on first location update, then let user pan freely
        if(firstUpdate){
          mapRef.current.setView([latitude,longitude],14);
          firstUpdate = false;
        }
      },()=>{}, {enableHighAccuracy:true,maximumAge:10000,timeout:10000});
    }
    
    // Sync other participants every 5 seconds
    const syncInterval = setInterval(syncParticipantsOnMap, 5000);
    return () => clearInterval(syncInterval);
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
      const adv=(window.__advertisers||[]).find(a=>a.id===advIdRef.current);
      const isFree = adv?.freeAdvertising;
      
      if(!isFree && !card){ setMsg("Please add a card on file to create paid coupons."); return; }
      
      const id='cp-'+Math.random().toString(36).slice(2,8);
      const s = start? new Date(start).getTime(): undefined;
      const e = end? new Date(end).getTime(): undefined;
      window.__coupons.push({
        id, advertiserId:advIdRef.current, system:false,
        title, desc, target, gnomeId: target==='one'? Number(gnomeId): undefined,
        startAt:s, endAt:e, scanCap: Number(scanCap)||0,
        unlocks:0, active, blocked:false
      });
      setMsg(isFree ? "Free coupon created!" : "Coupon created.");
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
            {advIdRef.current && (window.__advertisers||[]).find(a => a.id === advIdRef.current)?.freeAdvertising ? (
              <>
                <div className="text-[11px] text-green-700 font-semibold">✓ Free Advertising Enabled</div>
                <div className="text-[11px] text-gray-600">No charges for unlocks</div>
                <div className="mt-1">
                  <span className="inline-block text-[11px] px-2 py-0.5 rounded-full border bg-green-50 border-green-500">Card not required</span>
                </div>
              </>
            ) : (
              <>
                <div className="text-[11px] text-gray-600">Per unlock: {window.GV.fmtMoney(window.__costPerUnlock)} (once per device/gnome/cycle)</div>
                <div className="mt-1">
                  {card
                    ? <span className="inline-block text-[11px] px-2 py-0.5 rounded-full border bg-green-50 border-green-500">Card on file</span>
                    : <button className="rounded bg-black text-white px-2 py-1 text-xs" onClick={saveCardOnFile}>Add card & authorize</button>}
                </div>
              </>
            )}
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
  const [, forceUpdate] = useState({});
  const [auctionMode, setAuctionMode] = useState(window.__auctionEnabled);
  const [assignmentsHash, setAssignmentsHash] = useState('');

  // Subscribe to action state changes (for auction mode toggle)
  useEffect(() => {
    const handler = () => forceUpdate({});
    window.GV.actionHandlers.push(handler);
    return () => {
      const idx = window.GV.actionHandlers.indexOf(handler);
      if (idx > -1) window.GV.actionHandlers.splice(idx, 1);
    };
  }, []);

  // Poll for auction mode and assignment changes every 2 seconds
  useEffect(() => {
    const checkForChanges = () => {
      let changed = false;
      
      // Check auction mode
      if (window.__auctionEnabled !== auctionMode) {
        setAuctionMode(window.__auctionEnabled);
        changed = true;
      }
      
      // Check gnome assignments by creating a simple hash
      const newHash = JSON.stringify(
        Object.entries(window.__gnomeAssignments || {})
          .map(([id, a]) => `${id}:${a.partnerId}:${a.active}`)
          .sort()
      );
      
      if (newHash !== assignmentsHash) {
        setAssignmentsHash(newHash);
        changed = true;
      }
      
      if (changed) {
        forceUpdate({});
      }
    };
    
    const interval = setInterval(checkForChanges, 2000);
    
    // Also check on window focus (when switching tabs)
    const handleFocus = () => {
      checkForChanges();
    };
    window.addEventListener('focus', handleFocus);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [auctionMode, assignmentsHash]);

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
  
  function selectGnome(gnomeId){
    const p=partnerRef.current; 
    if(!p) {
      setMsg("Partner not found. Please log in.");
      return;
    }
    if(!est || !addr){ 
      setMsg("⚠️ Please fill in your establishment name and address before selecting a gnome."); 
      return; 
    }
    
    window.GV.performAction(async () => {
      const assignment = window.__gnomeAssignments[gnomeId];
      
      console.log('selectGnome called:', { gnomeId, assignment, partnerId: p.id });
      
      // If already claimed by this partner, deselect it
      if (assignment.partnerId === p.id) {
        assignment.partnerId = null;
        assignment.active = false;
        setMsg(`✓ Deselected gnome #${gnomeId}. It's now available for other partners.`);
      } else if (assignment.partnerId && assignment.partnerId !== p.id) {
        // Already claimed by someone else
        const otherPartner = (window.__partners||[]).find(x => x.id === assignment.partnerId);
        setMsg(`❌ Gnome #${gnomeId} is already claimed by ${otherPartner?.establishment || otherPartner?.name || 'another partner'}.`);
        return; // Don't proceed with the action
      } else {
        // Claim it
        assignment.partnerId = p.id;
        assignment.active = false; // Not active until trigger image uploaded and activated
        setMsg(`You've claimed gnome #${gnomeId}! Upload a trigger image to activate it.`);
      }
    }, "Gnome Selection Updated!");
  }
  function toggleActivate(gid){
    window.GV.performAction(async () => {
      const a=window.__gnomeAssignments[gid]; if(!a) return;
      const wasActive = a.active;
      a.active=!a.active;
      
      // If activating a gnome, check if this clears pending state
      if (a.active && !wasActive) {
        // Generate riddle for this gnome when activated
        const triggerImg = window.__triggerImages[gid];
        window.__gnomeRiddles[gid] = window.GV.generateRiddle(gid, triggerImg?.dataUrl);
        
        // If any gnome is active, clear pending state
        const anyActive = Object.values(window.__gnomeAssignments).some(assign => assign.active);
        if (anyActive) {
          window.__cyclePending = false;
        }
      }
      
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

  // Upload trigger image - automatically activates (no admin approval needed)
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
            // Auto-crop image to optimal scanning size
            const croppedDataUrl = await window.GV.autoCropImage(dataUrl);
            const hash=await window.GV.aHashFromDataUrl(croppedDataUrl);
            // Automatically assign to gnome - active immediately (admin can block if needed)
            window.__triggerImages[Number(gnomeId)] = {
              dataUrl: croppedDataUrl, 
              aHash: hash, 
              partnerId: p.id, 
              blocked: false, 
              ts: Date.now()
            };
            // Generate riddle for this gnome
            window.__gnomeRiddles[Number(gnomeId)] = window.GV.generateRiddle(Number(gnomeId), croppedDataUrl);
            setMsg(`Trigger image for #${gnomeId} is now ACTIVE! (auto-cropped to 800x800 for optimal scanning)`);
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
    }, "Trigger Image Activated!");
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
      
      {/* Cycle Countdown */}
      <div className="flex justify-center">
        <window.Components.CycleCountdown />
      </div>
      
      {/* Blocked Trigger Image Warning */}
      {(() => {
        const p = partnerRef.current;
        if (!p) return null;
        
        // Check for blocked trigger images for this partner's gnomes
        const blockedGnomes = myWins
          .filter(w => {
            const triggerImg = window.__triggerImages[w.gnome.id];
            return triggerImg && triggerImg.blocked && triggerImg.partnerId === p.id;
          })
          .map(w => w.gnome);
        
        if (blockedGnomes.length === 0) return null;
        
        return (
          <div className="rounded-2xl border-2 border-red-500 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <span className="text-3xl">⚠️</span>
              <div className="flex-1">
                <h3 className="font-bold text-red-900 mb-2">URGENT: Trigger Image Blocked by Admin</h3>
                <p className="text-red-800 mb-3">
                  The following gnome trigger images have been deactivated by the administrator. 
                  Participants cannot scan these gnomes until you upload new trigger images!
                </p>
                <div className="space-y-2">
                  {blockedGnomes.map(g => (
                    <div key={g.id} className="bg-white rounded-lg p-3 border border-red-300">
                      <div className="flex items-center gap-2">
                        <img src={g.image} alt={g.name} className="w-8 h-8" />
                        <span className="font-semibold text-red-900">
                          #{g.id} {g.name} Gnome
                        </span>
                      </div>
                      <p className="text-sm text-red-700 mt-1">
                        Please upload a new trigger image immediately using the Gnome Management section below.
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
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
            {window.__auctionEnabled && (
              card
                ? <span className="text-[11px] px-2 py-0.5 rounded-full border bg-green-50 border-green-500">Card on file</span>
                : <button className="rounded bg-black text-white px-2 py-1 text-xs" onClick={saveCard}>Add card & authorize</button>
            )}
            {!window.__auctionEnabled && (
              <span className="text-[11px] text-gray-600">Card not required in selection mode</span>
            )}
          </div>
        </div>
        {msg && <div className="mt-2 text-xs text-green-700">{msg}</div>}
      </div>

      {/* Bidding or Selection Mode */}
      {window.__auctionEnabled ? (
        <div className="rounded-2xl border p-3 bg-white">
          <h3 className="font-semibold text-sm mb-2">Bid for Gnomes (Auction Mode)</h3>
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
      ) : (
        <div className="rounded-2xl border p-3 bg-white">
          <h3 className="font-semibold text-sm mb-2">Select Your Gnomes (Direct Selection Mode)</h3>
          <p className="text-xs text-gray-600 mb-3">Click a gnome to claim it. No bidding required. First-come, first-served!</p>
          
          {/* Warning if profile incomplete */}
          {(!est || !addr) && (
            <div className="mb-4 p-3 rounded-lg border-2 border-yellow-400 bg-yellow-50">
              <div className="flex items-start gap-2">
                <span className="text-xl">⚠️</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-yellow-900 mb-1">Complete Your Profile First</p>
                  <p className="text-xs text-yellow-800">
                    Please fill in your <strong>Establishment Name</strong> and <strong>Address</strong> in the Partner Account section above before selecting gnomes.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {window.GV.GNOMES.map(g => {
              const assignment = window.__gnomeAssignments[g.id];
              const holder = assignment?.partnerId;
              const holderRec = (window.__partners||[]).find(p => p.id === holder);
              const isMine = holder === partnerRef.current?.id;
              const isAvailable = !holder;
              const canClick = isMine || isAvailable;
              
              return (
                <div 
                  key={g.id} 
                  className={`rounded-xl border-2 p-3 text-center transition-all ${
                    isMine ? 'border-green-500 bg-green-50 cursor-pointer' : 
                    isAvailable ? 'border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50 cursor-pointer' : 
                    'border-red-300 bg-red-50 opacity-60 cursor-not-allowed'
                  }`} 
                  onClick={() => {
                    if (canClick) {
                      selectGnome(g.id);
                    }
                  }}
                >
                  <img src={g.image} alt={g.name} className="w-16 h-16 mx-auto mb-2" />
                  <div className="text-xs font-semibold mb-1">#{g.id} {g.name}</div>
                  {isMine && (
                    <div className="text-xs font-bold text-green-700 mb-1">✓ Your Gnome</div>
                  )}
                  {isAvailable && !isMine && (
                    <div className="text-xs font-semibold text-blue-600">Available</div>
                  )}
                  {!isAvailable && !isMine && (
                    <>
                      <div className="text-xs font-semibold text-red-600 mb-1">Unavailable</div>
                      <div className="text-[10px] text-gray-600">{holderRec?.establishment || holderRec?.name || 'Claimed'}</div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

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
  
  function toggleAuctionMode(){
    window.GV.performAction(async () => {
      const wasEnabled = window.__auctionEnabled;
      window.__auctionEnabled = !window.__auctionEnabled;
      
      // If switching TO selection mode, offer to clear all assignments
      if (wasEnabled && !window.__auctionEnabled) {
        const hasAssignments = Object.values(window.__gnomeAssignments).some(a => a.partnerId !== null);
        if (hasAssignments) {
          const shouldClear = confirm(
            "You're switching to Selection Mode. Do you want to CLEAR all current gnome assignments so partners can select freely?\n\n" +
            "Click OK to clear all assignments (recommended)\n" +
            "Click Cancel to keep existing assignments"
          );
          
          if (shouldClear) {
            window.GV.GNOMES.forEach(g => {
              window.__gnomeAssignments[g.id] = {
                partnerId: null,
                active: false,
                previousPartnerId: window.__gnomeAssignments[g.id]?.partnerId || null
              };
            });
            setMsg(`Auction mode DISABLED and all gnome assignments cleared. Partners can now select gnomes freely.`);
          } else {
            setMsg(`Auction mode DISABLED but existing assignments kept. Partners can only claim unassigned gnomes.`);
          }
        } else {
          setMsg(`Auction mode DISABLED. Partners can now select gnomes directly (no card required).`);
        }
      } else {
        setMsg(`Auction mode ${window.__auctionEnabled ? 'ENABLED' : 'DISABLED'}. Partners ${window.__auctionEnabled ? 'must bid' : 'can select gnomes directly'}.`);
      }
    }, window.__auctionEnabled ? "Auction Mode Enabled!" : "Selection Mode Enabled!");
  }
  
  function toggleAdvertiserFreeAds(advertiser){
    window.GV.performAction(async () => {
      advertiser.freeAdvertising = !advertiser.freeAdvertising;
      setMsg(`${advertiser.name} ${advertiser.freeAdvertising ? 'can now advertise for FREE' : 'must pay per unlock'}.`);
    }, advertiser.freeAdvertising ? "Free Advertising Enabled!" : "Paid Advertising Required!");
  }

  function scheduleGolden(){
    const start = goldenDate ? new Date(goldenDate).getTime() : Date.now();
    const end   = start + Math.max(1,Number(goldenHours)||1)*3600000;
    window.__goldenScheduled = { start,end,gnomeId:Number(goldenTarget)||1, hint: goldenHint };
    setMsg("Golden Gnome scheduled.");
  }

  function closeBidsAndAssignWinners(){
    window.GV.performAction(async () => {
      // Set pending state - QR codes will show "Pending New Game Setup"
      window.__cyclePending = true;
      
      const newCelebrations = []; // Track celebrations for this cycle
      window.GV.GNOMES.forEach(g=>{
        let max=0, winner=null;
        for(const r of (window.__partnerBids||[])){ if(r.id===g.id && r.amt>max){ max=r.amt; winner=r.partnerId; } }
        const assign=window.__gnomeAssignments[g.id] || {partnerId:null,active:false,previousPartnerId:null};
        assign.previousPartnerId = assign.partnerId || null;
        assign.partnerId = winner || assign.partnerId;
        assign.active = false; // Inactive until partner activates
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
      window.__cycleStartTime = Date.now(); // Reset cycle timer
      
      // Clear riddles - will regenerate when partners activate
      window.__gnomeRiddles = {};
      
      setMsg(`Bids closed, ${newCelebrations.length} winner(s) assigned, cycle advanced. Game is now PENDING - partners must activate gnomes.`);
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

  function blockTriggerImage(gnomeId, flag){
    window.GV.performAction(async () => {
      const triggerImg = window.__triggerImages[gnomeId];
      if (!triggerImg) return;
      triggerImg.blocked = flag;
      setMsg(`${flag?'Blocked':'Unblocked'} trigger image for gnome #${gnomeId}.`);
    }, flag ? "Trigger Image Blocked!" : "Trigger Image Unblocked!");
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

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border p-3 bg-white">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Admin Controls</h3>
          <div className="text-[11px] text-gray-600">Logged in: <span className="font-mono">{user?.email||'—'}</span></div>
        </div>
        <div className="text-xs grid md:grid-cols-3 gap-3 mt-3">
          <label className="grid gap-1">Cost per unlock (advertiser)
            <input type="number" className="border rounded px-2 py-1" value={cost} onChange={e=>setCost(e.target.value)}/>
          </label>
          <div className="flex items-end">
            <button className="rounded bg-black text-white px-3 py-1.5 text-sm" onClick={setCostPerUnlock}>Update Cost</button>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox" 
                checked={window.__auctionEnabled} 
                onChange={toggleAuctionMode}
                className="w-4 h-4"
              />
              <span className="text-xs font-semibold">Auction Mode {window.__auctionEnabled ? 'ON' : 'OFF'}</span>
            </label>
          </div>
        </div>
        <div className="mt-2 text-[11px] text-gray-600">
          {window.__auctionEnabled ? 
            '✓ Partners must bid and win gnomes (card required)' : 
            '✓ Partners can select gnomes directly (no card required)'}
        </div>
        
        {/* Reset Assignments Button (useful for selection mode) */}
        {!window.__auctionEnabled && (
          <div className="mt-3 p-3 rounded-lg border border-orange-300 bg-orange-50">
            <div className="flex items-center justify-between">
              <div className="flex-1 mr-3">
                <p className="text-xs font-semibold text-orange-900 mb-1">Reset Gnome Assignments</p>
                <p className="text-[11px] text-orange-700">
                  Clear all current assignments to let partners select freely. Useful when switching to selection mode.
                </p>
              </div>
              <button 
                className="rounded bg-orange-600 hover:bg-orange-700 text-white px-3 py-1.5 text-xs font-semibold whitespace-nowrap"
                onClick={() => {
                  if (confirm('Are you sure you want to CLEAR ALL gnome assignments? This cannot be undone.')) {
                    window.GV.performAction(async () => {
                      window.GV.GNOMES.forEach(g => {
                        window.__gnomeAssignments[g.id] = {
                          partnerId: null,
                          active: false,
                          previousPartnerId: window.__gnomeAssignments[g.id]?.partnerId || null
                        };
                      });
                      setMsg('All gnome assignments have been cleared. Partners can now select freely.');
                    }, 'Assignments Cleared!');
                  }
                }}
              >
                🔄 Clear All Assignments
              </button>
            </div>
          </div>
        )}
        
        {msg && <div className="mt-2 text-xs text-green-700">{msg}</div>}
      </div>
      
      {/* Financial Ledger */}
      <div className="rounded-2xl border-2 border-green-400 bg-gradient-to-br from-green-50 to-emerald-50 p-4">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-3xl">💰</span>
          <div className="flex-1">
            <h3 className="font-semibold text-sm text-green-900 mb-1">Financial Ledger</h3>
            <p className="text-xs text-green-700">Revenue breakdown by partners and advertisers</p>
          </div>
        </div>
        
        {/* Summary */}
        {(() => {
          const charges = window.__charges || [];
          const partnerCharges = charges.filter(c => c.type === 'partner');
          const advertiserCharges = charges.filter(c => c.type === 'advertiser');
          const totalPartner = partnerCharges.reduce((sum, c) => sum + (c.amount || 0), 0);
          const totalAdvertiser = advertiserCharges.reduce((sum, c) => sum + (c.amount || 0), 0);
          const grandTotal = totalPartner + totalAdvertiser;
          
          return (
            <>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-white rounded-xl border-2 border-blue-300 p-3 text-center">
                  <div className="text-xs text-gray-600 mb-1">Partner Revenue</div>
                  <div className="text-xl font-black text-blue-900">{window.GV.fmtMoney(totalPartner)}</div>
                  <div className="text-[10px] text-gray-500">{partnerCharges.length} charges</div>
                </div>
                <div className="bg-white rounded-xl border-2 border-purple-300 p-3 text-center">
                  <div className="text-xs text-gray-600 mb-1">Advertiser Revenue</div>
                  <div className="text-xl font-black text-purple-900">{window.GV.fmtMoney(totalAdvertiser)}</div>
                  <div className="text-[10px] text-gray-500">{advertiserCharges.length} charges</div>
                </div>
                <div className="bg-gradient-to-br from-yellow-400 to-orange-400 rounded-xl border-2 border-orange-500 p-3 text-center">
                  <div className="text-xs text-white font-semibold mb-1">Total Revenue</div>
                  <div className="text-xl font-black text-white">{window.GV.fmtMoney(grandTotal)}</div>
                  <div className="text-[10px] text-white opacity-90">{charges.length} total charges</div>
                </div>
              </div>
              
              {/* Partner Breakdown */}
              <div className="mb-4">
                <h4 className="text-xs font-bold text-blue-900 mb-2 flex items-center gap-2">
                  <span>🏢</span> Partner Revenue Breakdown
                </h4>
                <div className="space-y-2">
                  {window.__partners.map(p => {
                    const pCharges = partnerCharges.filter(c => c.partnerId === p.id);
                    const pTotal = pCharges.reduce((sum, c) => sum + (c.amount || 0), 0);
                    if (pCharges.length === 0) return null;
                    
                    return (
                      <div key={p.id} className="bg-white rounded-lg border border-blue-200 p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <div className="text-xs font-semibold text-gray-900">{p.establishment || p.name}</div>
                            <div className="text-[10px] text-gray-500">{p.email}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-bold text-blue-900">{window.GV.fmtMoney(pTotal)}</div>
                            <div className="text-[10px] text-gray-500">{pCharges.length} charges</div>
                          </div>
                        </div>
                        <details className="text-xs">
                          <summary className="cursor-pointer text-blue-600 hover:underline text-[10px]">
                            View transaction history
                          </summary>
                          <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                            {pCharges.map((c, idx) => (
                              <div key={idx} className="flex justify-between text-[10px] border-t pt-1">
                                <span className="text-gray-600">{c.note || 'Charge'}</span>
                                <span className="font-mono font-semibold">{window.GV.fmtMoney(c.amount)}</span>
                                <span className="text-gray-400">{new Date(c.ts).toLocaleDateString()}</span>
                              </div>
                            ))}
                          </div>
                        </details>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              {/* Advertiser Breakdown */}
              <div>
                <h4 className="text-xs font-bold text-purple-900 mb-2 flex items-center gap-2">
                  <span>📢</span> Advertiser Revenue Breakdown
                </h4>
                <div className="space-y-2">
                  {advertisers.map(a => {
                    const aCharges = advertiserCharges.filter(c => c.advertiserId === a.id);
                    const aTotal = aCharges.reduce((sum, c) => sum + (c.amount || 0), 0);
                    if (aCharges.length === 0 && !a.freeAdvertising) return null;
                    
                    return (
                      <div key={a.id} className="bg-white rounded-lg border border-purple-200 p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <div className="text-xs font-semibold text-gray-900 flex items-center gap-2">
                              {a.name}
                              {a.freeAdvertising && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-300">
                                  FREE ADS
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-gray-500">{a.email || 'No email'}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-bold text-purple-900">{window.GV.fmtMoney(aTotal)}</div>
                            <div className="text-[10px] text-gray-500">{aCharges.length} charges</div>
                          </div>
                        </div>
                        {aCharges.length > 0 && (
                          <details className="text-xs">
                            <summary className="cursor-pointer text-purple-600 hover:underline text-[10px]">
                              View transaction history
                            </summary>
                            <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                              {aCharges.map((c, idx) => (
                                <div key={idx} className="flex justify-between text-[10px] border-t pt-1">
                                  <span className="text-gray-600">{c.note || 'Unlock charge'}</span>
                                  <span className="font-mono font-semibold">{window.GV.fmtMoney(c.amount)}</span>
                                  <span className="text-gray-400">{new Date(c.ts).toLocaleDateString()}</span>
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          );
        })()}
      </div>
      
      {/* Advertiser Management */}
      <div className="rounded-2xl border p-3 bg-white">
        <h3 className="font-semibold text-sm mb-2">Advertiser Management</h3>
        <div className="space-y-2">
          {advertisers.map(a => (
            <div key={a.id} className="rounded border p-2 flex items-center justify-between">
              <div className="flex-1">
                <div className="text-xs font-semibold">{a.name}</div>
                <div className="text-[11px] text-gray-600">{a.email || 'No email'}</div>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <input 
                    type="checkbox" 
                    checked={!!a.freeAdvertising} 
                    onChange={() => toggleAdvertiserFreeAds(a)}
                    className="w-4 h-4"
                  />
                  <span className={a.freeAdvertising ? 'text-green-600 font-semibold' : 'text-gray-600'}>
                    {a.freeAdvertising ? '✓ Free Ads' : 'Paid Ads'}
                  </span>
                </label>
                <button 
                  className={`rounded px-2 py-1 text-xs ${a.blocked ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}
                  onClick={() => blockAdvertiser(a, !a.blocked)}
                >
                  {a.blocked ? 'Unblock' : 'Block'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border p-3 bg-white">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-sm">Partner Bidding & Cycle Control</h3>
        </div>
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
        <h3 className="font-semibold text-sm mb-2">Trigger Image Management</h3>
        <p className="text-xs text-gray-600 mb-3">
          Partners upload trigger images automatically (no approval needed). Block inappropriate images here.
        </p>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {window.GV.GNOMES.map(g=>{
            const trig = window.__triggerImages[g.id];
            const partner = trig ? (window.__partners||[]).find(p => p.id === trig.partnerId) : null;
            return (
              <div key={g.id} className="rounded-xl border p-3">
                <div className="text-xs font-semibold mb-2 flex items-center gap-2">
                  <img src={g.image} className="w-5 h-5 object-contain" alt=""/>{`#${g.id} ${g.name}`}
                </div>
                {trig ? (
                  <>
                    <img src={trig.dataUrl} alt="" className="w-full h-24 object-cover rounded border mb-2"/>
                    <div className="text-[10px] text-gray-600 mb-1">
                      by {partner?.establishment || partner?.name || 'Unknown'}
                    </div>
                    <div className="text-[10px] mb-2">
                      {trig.blocked ? (
                        <span className="text-red-600 font-semibold">⛔ BLOCKED</span>
                      ) : (
                        <span className="text-green-600 font-semibold">✓ ACTIVE</span>
                      )}
                    </div>
                    <button 
                      className={`rounded px-2 py-1 text-xs w-full mb-2 ${trig.blocked ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}
                      onClick={() => blockTriggerImage(g.id, !trig.blocked)}
                    >
                      {trig.blocked ? 'Unblock' : 'Block'}
                    </button>
                  </>
                ) : (
                  <div className="text-[11px] text-gray-400 py-6 text-center">No image uploaded</div>
                )}
                <label className="block text-[11px]">Admin Upload
                  <input type="file" accept="image/*" className="mt-1 text-xs" onChange={e=>uploadDirectTrigger(g.id, e.target.files?.[0])}/>
                </label>
              </div>
            );
          })}
        </div>
      </div>

      {/* Universal Discovery QR Code */}
      <div className="rounded-2xl border-2 border-purple-400 bg-gradient-to-br from-purple-50 to-pink-50 p-4">
        <div className="flex items-start gap-3 mb-3">
          <span className="text-3xl">🌍</span>
          <div className="flex-1">
            <h3 className="font-semibold text-sm text-purple-900 mb-1">Universal Discovery QR Code</h3>
            <p className="text-xs text-purple-700">
              <strong>ONE QR code for ALL locations!</strong> When scanned, it detects the nearest gnome using geolocation and shows a celebration with clues. Perfect for physical deployment at multiple partner establishments.
            </p>
          </div>
        </div>
        <div className="bg-white rounded-xl border-2 border-purple-300 p-4 inline-block">
          {(() => {
            // Use public subdomain for discovery QR
            const baseUrl = 'https://launch.gnomeville.app';
            const discoverUrl = `${baseUrl}/discover`;
            const qrPng = window.GV.qrPngUrl(discoverUrl, 300);
            const qrSvg = window.GV.qrSvgUrl(discoverUrl, 300);
            return (
              <>
                <div className="text-center mb-3">
                  <div className="font-bold text-purple-900 mb-2">📍 Scan to Discover</div>
                  <img src={qrPng} alt="Universal Discovery QR" className="w-64 h-64 mx-auto rounded border-2 border-purple-200"/>
                </div>
                <div className="flex gap-2 justify-center">
                  <a 
                    href={qrPng} 
                    download="gnomeville-universal-discovery-qr.png"
                    className="text-xs bg-purple-600 text-white rounded px-3 py-2 hover:bg-purple-700 font-semibold"
                  >
                    📥 Download PNG
                  </a>
                  <button 
                    className="text-xs bg-black text-white rounded px-3 py-2 hover:bg-gray-800 font-semibold"
                    onClick={() => window.GV.downloadSvg(qrSvg, 'gnomeville-universal-discovery-qr.svg')}
                  >
                    📥 Download SVG
                  </button>
                </div>
                <div className="mt-3 text-xs text-center text-purple-700 bg-purple-100 rounded p-2">
                  <strong>Print this QR and place at ALL partner locations.</strong><br/>
                  It works everywhere and automatically detects the nearest gnome!
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {/* Individual QR Codes Section */}
      <div className="rounded-2xl border p-3 bg-white">
        <h3 className="font-semibold text-sm mb-2">Individual Gnome QR Codes</h3>
        <p className="text-xs text-gray-600 mb-3">
          Print these QR codes on posters for specific gnomes. When participants scan them, they'll see dynamic clues that update automatically when partners upload trigger images.
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

  // Check if this is a /gnome/:id URL or /discover
  const gnomeMatch = window.location.pathname.match(/\/gnome\/(\d+)/);
  const gnomeId = gnomeMatch ? parseInt(gnomeMatch[1], 10) : null;
  const isDiscoverPage = window.location.pathname === '/discover';

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

  // If accessing universal discover page, show location-based finder
  if (isDiscoverPage) {
    const DiscoverPage = window.Components.DiscoverPage;
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
        <GlobalFX />
        <header className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-center">
            <h1 className="text-2xl md:text-3xl font-black flex items-center gap-2">
              <img src="https://raw.githubusercontent.com/promos-cmyk/legendary-octo-broccoli/main/wildflower-favicon.png" alt="Wildflower" className="w-28 h-28 object-contain float-gnome"/>
              <span>WildFlower Gnomeville</span>
            </h1>
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-4 pb-12">
          <DiscoverPage />
        </main>
        <footer className="max-w-6xl mx-auto px-4 py-8 text-center text-[11px] text-gray-500">
          <p>© 2024 WildFlower Gnomeville. Powered by magic & community spirit.</p>
        </footer>
      </div>
    );
  }

  // If accessing a gnome clue page, show just that
  if (gnomeId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
        <GlobalFX />
        <header className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-center">
            <h1 className="text-2xl md:text-3xl font-black flex items-center gap-2">
              <img src="https://raw.githubusercontent.com/promos-cmyk/legendary-octo-broccoli/main/wildflower-favicon.png" alt="Wildflower" className="w-28 h-28 object-contain float-gnome"/>
              <span>WildFlower Gnomeville</span>
            </h1>
          </div>
        </header>
        <main>
          <window.Components.GnomeClue gnomeId={gnomeId} />
        </main>
        <footer className="max-w-6xl mx-auto px-4 py-8 text-center text-[11px] text-gray-500">
          <span>© {new Date().getFullYear()} WildFlower FL • gnomeville.app</span>
        </footer>
      </div>
    );
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
