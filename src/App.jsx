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

/* ---------- Gnome Cycle (resets bonus when winners change) ---------- */
/* The cycle id represents the current bid/assignment period.
   Admin should bump this when closing bids + assigning new winners. */
window.GV.getCycleId = () => {
  // Fallback to persistent value or a monthly key if nothing set yet
  let cid = localStorage.getItem("__gnome_cycle_id");
  if (!cid) {
    cid = `cycle_${new Date().getFullYear()}_${String(new Date().getMonth()+1).padStart(2,'0')}`;
    localStorage.setItem("__gnome_cycle_id", cid);
  }
  return cid;
};

window.GV.bumpCycle = (label) => {
  // Generate a fresh cycle id; optional label for audits (e.g., "2025-11 winners")
  const cid = `cycle_${Date.now()}${label ? `_${label.replace(/[^a-z0-9_-]/gi,'')}` : ""}`;
  localStorage.setItem("__gnome_cycle_id", cid);
  // Broadcast so open tabs reset immediately
  try {
    window.dispatchEvent(new StorageEvent("storage", { key: "__gnome_cycle_id", newValue: cid }));
  } catch {}
  return cid;
};

/* ---------- Bonus Spins Push System ---------- */
window.GV.pushBonusSpins = (count) => {
  const pushId = `push_${Date.now()}`;
  const pushData = { count, pushId, ts: Date.now() };
  
  // Store the push notification in localStorage
  localStorage.setItem("__bonus_push", JSON.stringify(pushData));
  
  // IMPORTANT: Set a cookie that works across subdomains
  // Detect the base domain and set cookie appropriately
  const hostname = window.location.hostname;
  const expires = new Date(Date.now() + 60 * 60 * 1000).toUTCString();
  
  // Try to set cookie with domain for production (gnomeville.app)
  if (hostname.includes('gnomeville.app')) {
    document.cookie = `__bonus_push=${encodeURIComponent(JSON.stringify(pushData))}; domain=.gnomeville.app; path=/; expires=${expires}; SameSite=Lax`;
  } else if (hostname.includes('vercel.app')) {
    // For Vercel domains, extract the base domain
    const parts = hostname.split('.');
    if (parts.length >= 3) {
      const baseDomain = '.' + parts.slice(-3).join('.');
      document.cookie = `__bonus_push=${encodeURIComponent(JSON.stringify(pushData))}; domain=${baseDomain}; path=/; expires=${expires}; SameSite=Lax`;
    }
  }
  // Also set without domain restriction for same-origin access
  document.cookie = `__bonus_push=${encodeURIComponent(JSON.stringify(pushData))}; path=/; expires=${expires}; SameSite=Lax`;
  
  // CRITICAL: Add spins to ALL known user storage keys (broadcast to all participants)
  // This is a workaround since we don't have a backend database
  // In production, this should be done server-side
  try {
    // Get all bonus_spins_* keys from localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('bonus_spins_')) {
        try {
          const existing = JSON.parse(localStorage.getItem(key) || '{"remaining":0,"totalWon":0,"wonGnomes":[]}');
          existing.remaining = (existing.remaining || 0) + count;
          localStorage.setItem(key, JSON.stringify(existing));
        } catch(e) {
          console.warn('Failed to update bonus spins for key:', key, e);
        }
      }
    }
    
    // Also add to current device/user even if not in localStorage yet
    const currentUserEmail = window.GV.loadUser()?.email;
    const currentStorageKey = currentUserEmail || window.GV.DEVICE_ID;
    const BONUS_SPINS_KEY = `bonus_spins_${currentStorageKey}`;
    
    const existing = JSON.parse(localStorage.getItem(BONUS_SPINS_KEY) || '{"remaining":0,"totalWon":0,"wonGnomes":[]}');
    existing.remaining = (existing.remaining || 0) + count;
    localStorage.setItem(BONUS_SPINS_KEY, JSON.stringify(existing));
  } catch(e) {
    console.warn('Failed to add bonus spins', e);
  }
  
  // Broadcast to all open tabs
  try {
    window.dispatchEvent(new StorageEvent("storage", { key: "__bonus_push", newValue: JSON.stringify(pushData) }));
  } catch {}
  
  return pushId;
};

/* ---------- Bonus Spins Campaign System ---------- */
window.GV.pushBonusSpinsCampaign = (count, durationHours) => {
  const pushId = `campaign_${Date.now()}`;
  const startTime = Date.now();
  const endTime = startTime + (durationHours * 60 * 60 * 1000);
  
  const campaignData = { 
    count, 
    pushId, 
    startTime, 
    endTime, 
    durationHours,
    ts: startTime 
  };
  
  // Store the campaign in localStorage
  localStorage.setItem("__bonus_campaign", JSON.stringify(campaignData));
  
  // Set cross-domain cookie
  const hostname = window.location.hostname;
  const expires = new Date(endTime).toUTCString();
  
  if (hostname.includes('gnomeville.app')) {
    document.cookie = `__bonus_campaign=${encodeURIComponent(JSON.stringify(campaignData))}; domain=.gnomeville.app; path=/; expires=${expires}; SameSite=Lax`;
  } else if (hostname.includes('vercel.app')) {
    const parts = hostname.split('.');
    if (parts.length >= 3) {
      const baseDomain = '.' + parts.slice(-3).join('.');
      document.cookie = `__bonus_campaign=${encodeURIComponent(JSON.stringify(campaignData))}; domain=${baseDomain}; path=/; expires=${expires}; SameSite=Lax`;
    }
  }
  document.cookie = `__bonus_campaign=${encodeURIComponent(JSON.stringify(campaignData))}; path=/; expires=${expires}; SameSite=Lax`;
  
  // Add spins to ALL participants
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('bonus_spins_')) {
        try {
          const existing = JSON.parse(localStorage.getItem(key) || '{"remaining":0,"totalWon":0,"wonGnomes":[],"campaignExpiry":null}');
          existing.remaining = (existing.remaining || 0) + count;
          existing.campaignExpiry = endTime; // Track when spins expire
          existing.campaignId = pushId;
          localStorage.setItem(key, JSON.stringify(existing));
        } catch(e) {
          console.warn('Failed to update bonus spins for key:', key, e);
        }
      }
    }
    
    // Current device/user
    const currentUserEmail = window.GV.loadUser()?.email;
    const currentStorageKey = currentUserEmail || window.GV.DEVICE_ID;
    const BONUS_SPINS_KEY = `bonus_spins_${currentStorageKey}`;
    
    const existing = JSON.parse(localStorage.getItem(BONUS_SPINS_KEY) || '{"remaining":0,"totalWon":0,"wonGnomes":[],"campaignExpiry":null}');
    existing.remaining = (existing.remaining || 0) + count;
    existing.campaignExpiry = endTime;
    existing.campaignId = pushId;
    localStorage.setItem(BONUS_SPINS_KEY, JSON.stringify(existing));
  } catch(e) {
    console.error('Campaign push error:', e);
  }
  
  return pushId;
};

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

/* NEW: Auction mode toggle - per city. Structure: {cityName: boolean} */
if(!window.__auctionEnabledByCity) window.__auctionEnabledByCity = {};

/* NEW: Admin claimed gnomes - { gnomeId: { establishment, address, city, imageDataUrl, ts } } */
if(!window.__adminClaimedGnomes) window.__adminClaimedGnomes = {};

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

/* NEW: User profile storage - stores all user data per email */
if(!window.__userProfiles) window.__userProfiles = {}; // { email: { participant: {...}, partner: {...}, advertiser: {...}, admin: {...} } }

/* Helper to get user-specific storage key */
window.GV.getUserStorageKey = (email, dataType) => {
  if (!email) return null;
  return `user_${email}_${dataType}`;
};

/* Helper to save user profile data */
window.GV.saveUserProfile = (email, role, data) => {
  if (!email || !role) return;
  
  if (!window.__userProfiles[email]) {
    window.__userProfiles[email] = { participant: {}, partner: {}, advertiser: {}, admin: {} };
  }
  
  window.__userProfiles[email][role] = {
    ...window.__userProfiles[email][role],
    ...data,
    lastUpdated: Date.now(),
    cycleId: window.__cycleId
  };
  
  // Persist to localStorage
  try {
    localStorage.setItem(`user_profile_${email}`, JSON.stringify(window.__userProfiles[email]));
  } catch (e) {
    console.warn('Failed to save user profile:', e);
  }
};

/* Helper to load user profile data */
window.GV.loadUserProfile = (email, role) => {
  if (!email) return null;
  
  // Try loading from memory first
  if (window.__userProfiles[email] && window.__userProfiles[email][role]) {
    return window.__userProfiles[email][role];
  }
  
  // Try loading from localStorage
  try {
    const saved = localStorage.getItem(`user_profile_${email}`);
    if (saved) {
      window.__userProfiles[email] = JSON.parse(saved);
      return window.__userProfiles[email][role] || {};
    }
  } catch (e) {
    console.warn('Failed to load user profile:', e);
  }
  
  return {};
};

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
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    .float-gnome, .float-gnome-sm { animation: gfloatdance 3.2s ease-in-out infinite; }
    .spin-logo { animation: spin 3s linear infinite; }
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
    
    /* --- Gnome Bonus button glow / pulse --- */
    @keyframes pulse-glow {
      0%   { filter: drop-shadow(0 0 0 rgba(16,185,129,.0)) brightness(1.0); transform: translateY(0); }
      50%  { filter: drop-shadow(0 0 16px rgba(16,185,129,.75)) brightness(1.25); transform: translateY(-2px); }
      100% { filter: drop-shadow(0 0 0 rgba(16,185,129,.0)) brightness(1.0); transform: translateY(0); }
    }
    .bonus-ready {
      background: #10b981; /* emerald-500 */
      color: white;
      border-color: #059669;
      animation: pulse-glow 1.8s ease-in-out infinite, gfloatdance 3.2s ease-in-out infinite;
    }
    .bonus-disabled {
      background: #e5e7eb; /* gray-200 */
      color: #6b7280;      /* gray-500 */
      border-color: #d1d5db;
      cursor: not-allowed;
      pointer-events: none;
    }
    .slot-reel {
      width: 90px; height: 300px; border-radius: 12px; border: 2px solid #374151;
      overflow: hidden; background: linear-gradient(#f9fafb, #e5e7eb);
      position: relative;
    }
    .slot-reel-strip {
      display: flex; flex-direction: column; position: relative;
      transition: transform 0.1s linear;
    }
    .slot-reel-item {
      width: 90px; height: 100px; display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .slot-reel-item img { width: 70px; height: 70px; object-fit: contain; }
    .slot-frame {
      border-radius: 20px; border: 4px solid #1f2937; background: linear-gradient(135deg, #1f2937, #111827);
      padding: 16px; box-shadow: 0 20px 40px rgba(0,0,0,0.6);
    }
    .slot-viewport {
      background: linear-gradient(135deg, #0f172a, #1e293b); 
      border-radius: 16px; padding: 12px;
      box-shadow: inset 0 4px 12px rgba(0,0,0,0.5);
    }
    .slot-status {
      font-size: 14px; color: #94a3b8; margin-top: 8px; text-align: center; font-weight: 600;
    }
    @keyframes spin-reel {
      0%   { transform: translateY(0); }
      100% { transform: translateY(-100%); }
    }
    .spinning {
      animation: spin-reel 0.1s linear infinite;
    }
    .middle-row-highlight {
      position: absolute; top: 100px; left: 0; right: 0; height: 100px;
      border: 3px solid #fbbf24; border-radius: 8px;
      pointer-events: none; z-index: 10;
      box-shadow: 0 0 20px rgba(251,191,36,0.6);
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

window.GV.addrToLatLng=(a, partner)=>{
  // If partner object provided and has exact coordinates, use those
  if (partner && partner.lat && partner.lng) {
    return { lat: partner.lat, lng: partner.lng };
  }
  
  // Otherwise use hash-based approximation
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

window.Components.CycleBadge = function({ className="" }) {
  const [cid, setCid] = React.useState(() => window.GV.getCycleId());
  
  React.useEffect(() => {
    function onStorage(e){
      if (e.key === "__gnome_cycle_id") {
        const v = localStorage.getItem("__gnome_cycle_id");
        if (v) setCid(v);
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  
  const label = cid?.replace(/^cycle_/, "") || "—";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] bg-white shadow-sm ${className}`}
      title="The current hunt cycle. Admin bumps this when winners are published.">
      <span className="w-1 h-1 rounded-full bg-emerald-500" />
      <span className="font-medium text-[9px]">Cycle</span>
      <span className="font-mono text-[8px]">{label}</span>
    </span>
  );
};

window.Components.PopularityGrid=function({title,showActive}){
  const rows=window.GV.popularity30d(); const max=Math.max(1,...rows.map(r=>r.scans));
  return (
    <div className="rounded-2xl border p-3 bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white">
      <h3 className="font-semibold text-sm mb-2">{title}</h3>
      <div className="grid md:grid-cols-5 gap-2">
        {rows.map(r=>(
          <div key={r.id} className="rounded-2xl border p-3 bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white">
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
    <div className="rounded-2xl border p-3 bg-white shadow-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white">
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
          
          const gnomeLocation = window.GV.addrToLatLng(partner.address, partner); // Pass partner for exact coordinates
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
      <div className="max-w-2xl mx-auto p-6 relative">
        {/* Spinning logo in top left corner */}
        <div className="absolute top-0 left-0 z-10">
          <img src="https://raw.githubusercontent.com/promos-cmyk/legendary-octo-broccoli/main/wildflower-favicon.png" alt="Wildflower" className="w-24 h-24 object-contain spin-logo"/>
        </div>
        
        <div className="rounded-2xl border-2 border-yellow-400 bg-gradient-to-br from-yellow-50 to-orange-50 p-8 text-center relative overflow-hidden">
          <div className="mb-6">
            <div className="flex flex-col items-center mb-2">
              <h1 className="text-3xl md:text-4xl font-black text-orange-900 leading-tight">
                WildFlower Gnomeville<br/>
                <span className="text-2xl md:text-3xl">Jax Beach!</span>
              </h1>
            </div>
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
            <p className="text-gray-800 text-lg mb-2">
              🎮 <strong>The hunt hasn't started yet!</strong>
            </p>
            <p className="text-gray-700 text-xs">
              Our partner restaurants are currently setting up their gnome locations. 
              Check back soon to start your treasure hunt adventure!
            </p>
          </div>
          
          <button 
            onClick={() => window.location.href = '/?enableMap=true'}
            className="bg-orange-600 hover:bg-orange-700 text-black font-bold py-3 px-6 rounded-full text-sm transition-all active:scale-95"
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

/* ---------- Bonus Page (Slot Machine) ---------- */
window.Components.BonusPage = function({ user, role }) {
  const userEmail = user?.email;
  const storageKey = userEmail || window.GV.DEVICE_ID; // Use email if logged in, otherwise device ID
  const BONUS_SPINS_KEY = `bonus_spins_${storageKey}`;

  function readBonusData() {
    try {
      const saved = JSON.parse(localStorage.getItem(BONUS_SPINS_KEY));
      return saved || { remaining: 0, totalWon: 0, wonGnomes: [] };
    } catch { 
      return { remaining: 0, totalWon: 0, wonGnomes: [] };
    }
  }

  const initialData = readBonusData();
  const [remainingSpins, setRemainingSpins] = useState(initialData.remaining);
  const [totalWon, setTotalWon] = useState(initialData.totalWon);
  const [wonGnomes, setWonGnomes] = useState(initialData.wonGnomes || []);
  const [spinning, setSpinning] = useState(false);
  const [reels, setReels] = useState(() => {
    const gnomes = window.GV.GNOMES;
    return Array(5).fill(0).map(() => 
      Array(10).fill(0).map(() => Math.floor(Math.random() * gnomes.length))
    );
  });
  const [reelOffsets, setReelOffsets] = useState([0, 0, 0, 0, 0]);
  const [winMsg, setWinMsg] = useState("");

  function persistBonusData(remaining, totalWon, wonGnomes) {
    try {
      localStorage.setItem(BONUS_SPINS_KEY, JSON.stringify({
        remaining, totalWon, wonGnomes
      }));
    } catch(e) { console.warn('persist bonus failed', e); }
  }

  // Listen for bonus push events
  useEffect(() => {
    function onStorage(e) {
      if (e.key === "__bonus_push") {
        try {
          const pushData = JSON.parse(e.newValue);
          if (pushData && pushData.count > 0) {
            const lastPushId = localStorage.getItem("__last_bonus_push_id");
            if (lastPushId !== pushData.pushId) {
              setRemainingSpins(prev => {
                const newRemaining = prev + pushData.count;
                setTotalWon(currentTotal => {
                  setWonGnomes(currentWon => {
                    persistBonusData(newRemaining, currentTotal, currentWon);
                    return currentWon;
                  });
                  return currentTotal;
                });
                return newRemaining;
              });
              localStorage.setItem("__last_bonus_push_id", pushData.pushId);
            }
          }
        } catch(err) { console.warn('bonus push parse failed', err); }
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Check for bonus push on mount and poll every second
  useEffect(() => {
    function checkBonusPush() {
      try {
        // First check localStorage
        let pushData = JSON.parse(localStorage.getItem("__bonus_push"));
        
        // If not in localStorage, check cookie (for cross-subdomain support)
        if (!pushData) {
          const cookies = document.cookie.split(';');
          const bonusCookie = cookies.find(c => c.trim().startsWith('__bonus_push='));
          if (bonusCookie) {
            try {
              const cookieValue = decodeURIComponent(bonusCookie.split('=')[1]);
              pushData = JSON.parse(cookieValue);
              // Copy to localStorage for future checks
              if (pushData) {
                localStorage.setItem("__bonus_push", JSON.stringify(pushData));
              }
            } catch(e) {
              console.warn('Failed to parse bonus push cookie', e);
            }
          }
        }
        
        if (pushData && pushData.count > 0) {
          const lastPushId = localStorage.getItem("__last_bonus_push_id");
          if (lastPushId !== pushData.pushId) {
            setRemainingSpins(prev => {
              const newRemaining = prev + pushData.count;
              setTotalWon(currentTotal => {
                setWonGnomes(currentWon => {
                  persistBonusData(newRemaining, currentTotal, currentWon);
                  return currentWon;
                });
                return currentTotal;
              });
              return newRemaining;
            });
            localStorage.setItem("__last_bonus_push_id", pushData.pushId);
          }
        }
      } catch(e) {
        console.warn('checkBonusPush failed', e);
      }
    }
    
    // Check immediately on mount
    checkBonusPush();
    
    // Poll every second for new pushes
    const interval = setInterval(checkBonusPush, 1000);
    
    return () => clearInterval(interval);
  }, []);

  // Auto-redirect when spins exhausted
  useEffect(() => {
    if (remainingSpins === 0 && totalWon > 0) {
      setTimeout(() => {
        window.location.href = 'https://gnomeville.app';
      }, 3000);
    }
  }, [remainingSpins, totalWon]);

  function randomGnomeIndex() {
    return Math.floor(Math.random() * window.GV.GNOMES.length);
  }

  function startSpin() {
    if (spinning || remainingSpins <= 0) return;
    setSpinning(true);
    setWinMsg("");

    const willWin = Math.random() < 0.15;
    const targetIndex = randomGnomeIndex();

    // Generate new reel strips
    const newReels = Array(5).fill(0).map(() => 
      Array(10).fill(0).map(() => randomGnomeIndex())
    );

    // Set middle row (index 1) to winning gnomes if winning
    if (willWin) {
      newReels.forEach(reel => { reel[1] = targetIndex; });
    }

    setReels(newReels);

    // Animate reels spinning
    const spinIntervals = [];
    for (let i = 0; i < 5; i++) {
      let offset = 0;
      const interval = setInterval(() => {
        offset = (offset + 10) % 100;
        setReelOffsets(prev => {
          const next = [...prev];
          next[i] = offset;
          return next;
        });
      }, 50);
      spinIntervals.push(interval);

      setTimeout(() => {
        clearInterval(interval);
        setReelOffsets(prev => {
          const next = [...prev];
          next[i] = 0;
          return next;
        });
      }, 1500 + i * 300);
    }

    setTimeout(() => {
      setSpinning(false);
      spinIntervals.forEach(clearInterval);

      const middleRow = newReels.map(reel => reel[1]);
      const isWin = middleRow.every((v, i, a) => v === a[0]);

      if (isWin) {
        const winGnome = window.GV.GNOMES[middleRow[0]];
        setWinMsg("🎉 NEW GNOME UNLOCKED! 🎉");
        window.GV.celebrateRain();
        
        const newWonGnomes = [...wonGnomes, winGnome];
        const newTotalWon = totalWon + 1;
        setWonGnomes(newWonGnomes);
        setTotalWon(newTotalWon);

        if (role === 'participant') {
          const foundMethods = JSON.parse(localStorage.getItem(`found_methods_${window.GV.DEVICE_ID}`) || '[]');
          const foundIds = foundMethods.map(f => f.gnomeId);
          if (!foundIds.includes(winGnome.id)) {
            foundMethods.push({gnomeId: winGnome.id, method: 'slot', ts: Date.now()});
            localStorage.setItem(`found_methods_${window.GV.DEVICE_ID}`, JSON.stringify(foundMethods));
          }
        }

        const newRemaining = remainingSpins - 1;
        setRemainingSpins(newRemaining);
        persistBonusData(newRemaining, newTotalWon, newWonGnomes);
      } else {
        setWinMsg("No match this time. Try again!");
        const newRemaining = remainingSpins - 1;
        setRemainingSpins(newRemaining);
        persistBonusData(newRemaining, totalWon, wonGnomes);
      }
    }, 2500);
  }

  // Admin can add spins for testing
  function adminAddSpins() {
    if (role !== 'admin') return;
    const newRemaining = remainingSpins + 3;
    setRemainingSpins(newRemaining);
    persistBonusData(newRemaining, totalWon, wonGnomes);
  }

  const hasSpins = remainingSpins > 0;
  const canSpin = hasSpins && !spinning;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6 text-center">
        <h1 className="text-3xl md:text-4xl font-black mb-2">🎰 Gnome Bonus Slot Machine</h1>
        <p className="text-gray-600">Match all 5 gnomes in the middle row to unlock a bonus gnome!</p>
      </div>

      <div className="rounded-2xl border-2 border-emerald-500 bg-gradient-to-br from-emerald-50 to-teal-50 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Your Status</h3>
          {user && <div className="text-[11px] text-gray-600">Signed in as <span className="font-mono">{user.email}</span></div>}
        </div>
        
        <div className="grid md:grid-cols-3 gap-4 mb-4">
          <div className="bg-white rounded-lg p-3 border">
            <div className="text-xs text-gray-500 mb-1">Remaining Spins</div>
            <div className="text-3xl font-black text-emerald-600">{remainingSpins}</div>
          </div>
          <div className="bg-white rounded-lg p-3 border">
            <div className="text-xs text-gray-500 mb-1">Gnomes Won (Session)</div>
            <div className="text-3xl font-black text-blue-600">{totalWon}</div>
          </div>
          <div className="bg-white rounded-lg p-3 border">
            <div className="text-xs text-gray-500 mb-1">Win Rate</div>
            <div className="text-lg font-bold">~15%</div>
          </div>
        </div>

        {role === 'admin' && (
          <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 mb-4">
            <div className="text-xs font-semibold text-yellow-900 mb-2">Admin Controls</div>
            <button 
              onClick={adminAddSpins}
              className="rounded bg-yellow-600 text-white px-3 py-1.5 text-sm hover:bg-yellow-700"
            >
              Add 3 Spins (Testing)
            </button>
          </div>
        )}

        {!hasSpins ? (
          <div className="bg-blue-50 border border-blue-300 rounded-lg p-4 text-center">
            <p className="text-sm text-blue-900">
              {totalWon > 0 
                ? '� Session complete! Redirecting you back to the main page...'
                : '🔓 Wait for bonus spins to be pushed by admin!'}
            </p>
          </div>
        ) : null}
      </div>

      {/* Realistic 3x5 Slot Machine */}
      <div className="slot-frame mx-auto max-w-3xl">
        <div className="slot-viewport relative">
          {/* Middle row highlight */}
          <div className="middle-row-highlight" />
          
          <div className="grid grid-cols-5 gap-2 justify-items-center">
            {reels.map((reel, reelIdx) => (
              <div key={reelIdx} className="slot-reel">
                <div 
                  className={`slot-reel-strip ${spinning ? 'spinning' : ''}`}
                  style={{transform: `translateY(${-reelOffsets[reelIdx]}px)`}}
                >
                  {reel.map((gnomeIdx, itemIdx) => (
                    <div key={itemIdx} className="slot-reel-item">
                      <img 
                        src={window.GV.GNOMES[gnomeIdx]?.image} 
                        alt={window.GV.GNOMES[gnomeIdx]?.name || ''} 
                        className="float-gnome"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 flex flex-col items-center gap-3">
          <button
            className={`rounded-lg px-8 py-4 text-xl font-black shadow-lg transition-all ${
              canSpin
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700 hover:shadow-xl'
                : 'bg-gray-300 text-gray-600 cursor-not-allowed pointer-events-none'
            }`}
            onClick={startSpin}
          >
            {!hasSpins ? '🎫 No Spins' : (spinning ? '🎰 Spinning…' : '🎰 SPIN NOW')}
          </button>
          
          {hasSpins && (
            <p className="text-sm text-gray-500">
              {remainingSpins} spin{remainingSpins !== 1 ? 's' : ''} remaining
            </p>
          )}
        </div>

        {winMsg && (
          <div className="text-center mt-6">
            <div className="text-3xl font-black text-emerald-600 mb-2">{winMsg}</div>
            {wonGnomes.length > 0 && wonGnomes[wonGnomes.length - 1] && (
              <div className="text-lg text-gray-700">
                You unlocked <strong>{wonGnomes[wonGnomes.length - 1].name}</strong>!
              </div>
            )}
          </div>
        )}

        <div className="text-xs text-center text-gray-600 mt-4">
          Match all 5 gnomes in the highlighted middle row to unlock a bonus gnome!
        </div>
      </div>

      {/* Won Gnomes This Session */}
      {wonGnomes.length > 0 && (
        <div className="mt-6 rounded-2xl border-2 border-blue-400 bg-gradient-to-br from-blue-50 to-cyan-50 p-6">
          <h3 className="font-semibold mb-3 text-blue-900">🎉 Gnomes Won This Session ({wonGnomes.length})</h3>
          <div className="grid grid-cols-5 gap-3">
            {wonGnomes.map((gnome, idx) => (
              <div key={idx} className="bg-white rounded-lg p-2 border border-blue-300 text-center">
                <img src={gnome.image} alt={gnome.name} className="w-14 h-14 mx-auto float-gnome-sm" />
                <p className="text-[10px] font-semibold mt-1">{gnome.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* How It Works */}
      <div className="mt-8 rounded-2xl border p-6 bg-white">
        <h3 className="font-semibold mb-3">How It Works</h3>
        <ul className="list-disc ml-4 space-y-2 text-sm text-gray-700">
          <li>Admin pushes bonus spins to all participants</li>
          <li>Match all 5 gnomes in the middle row to unlock a bonus gnome</li>
          <li>Won gnomes are marked as blue in your progress tracker</li>
          <li>Unlocked gnomes qualify you for special rewards</li>
          <li>Visit gnomeville.app to see your complete collection!</li>
        </ul>
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
const Participant = React.forwardRef(function Participant({user, darkMode, setDarkMode}, ref) {
  const [found,setFound]=useState([]); // Array of {gnomeId, method: 'trigger'|'slot', ts}
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
  
  // --- Hunting Mode States ---
  const [huntingMode, setHuntingMode] = useState(false);
  const [selectedWeapon, setSelectedWeapon] = useState('net'); // 'net', 'crossbow', 'shortbow', 'dart'
  const [gnomeSpotted, setGnomeSpotted] = useState(null); // {gnomeId, name, image, position, speed}
  const [gnomeRunning, setGnomeRunning] = useState(false);
  const [shotFired, setShotFired] = useState(false);
  const [captureSuccess, setCaptureSuccess] = useState(null);
  const [shieldStrength, setShieldStrength] = useState(100); // 0-100%
  const [gnomeShootingBack, setGnomeShootingBack] = useState(false);
  const [gnomeProjectileFired, setGnomeProjectileFired] = useState(false);
  const [powerFlash, setPowerFlash] = useState(false);
  const huntingVideoRef = useRef(null);
  const huntingCanvasRef = useRef(null);
  const huntingStreamRef = useRef(null);
  const gnomePositionRef = useRef({ x: 50, y: 50 }); // percentage position
  const gnomeDirectionRef = useRef({ dx: 2, dy: 1.5 }); // movement vector
  const animationFrameRef = useRef(null);
  const gnomeShootTimerRef = useRef(null);
  
  // --- Gnome Bonus: persistent by device AND by cycle ---
  const CURRENT_CYCLE_ID = window.GV.getCycleId();
  const userEmail = user?.email;
  const storageKey = userEmail || window.GV.DEVICE_ID; // Use email if logged in, otherwise device ID
  const BONUS_KEY = `bonus_state_${storageKey}`; // stores {cycleId, ready, spinUsed}
  const BONUS_SPINS_KEY = `bonus_spins_${storageKey}`; // stores {remaining, totalWon, wonGnomes}
  
  const [remainingBonusSpins, setRemainingBonusSpins] = useState(0);
  const [bonusCampaign, setBonusCampaign] = useState(null); // {count, startTime, endTime, durationHours, pushId}
  const [campaignTimeLeft, setCampaignTimeLeft] = useState(0); // milliseconds

  // Load user profile data on mount or when user changes
  useEffect(() => {
    if (!userEmail) {
      // No user logged in, use device-based storage
      const savedFound = JSON.parse(localStorage.getItem(`found_methods_${window.GV.DEVICE_ID}`) || '[]');
      setFound(savedFound);
    } else {
      // User logged in, load their profile
      const profile = window.GV.loadUserProfile(userEmail, 'participant');
      
      if (profile.foundGnomes) {
        setFound(profile.foundGnomes);
      }
      
      if (profile.unlocked) {
        setUnlocked(profile.unlocked);
      }
    }
    
    // Load remaining bonus spins
    try {
      const bonusData = JSON.parse(localStorage.getItem(BONUS_SPINS_KEY));
      console.log('Loading bonus spins:', BONUS_SPINS_KEY, bonusData);
      if (bonusData && bonusData.remaining) {
        setRemainingBonusSpins(bonusData.remaining);
      } else {
        setRemainingBonusSpins(0);
      }
    } catch {
      setRemainingBonusSpins(0);
    }
  }, [userEmail, BONUS_SPINS_KEY]);

  // Helper to save found gnomes with methods
  function saveFoun(foundArray) {
    // Save to localStorage (for device-based access)
    localStorage.setItem(`found_methods_${storageKey}`, JSON.stringify(foundArray));
    setFound(foundArray);
    
    // If user is logged in, also save to their profile
    if (userEmail) {
      window.GV.saveUserProfile(userEmail, 'participant', {
        foundGnomes: foundArray
      });
    }
  }
  
  // Save unlocked coupons to user profile
  function saveUnlocked(unlockedArray) {
    setUnlocked(unlockedArray);
    
    if (userEmail) {
      window.GV.saveUserProfile(userEmail, 'participant', {
        unlocked: unlockedArray
      });
    }
  }

  function readBonusState() {
    try {
      const saved = JSON.parse(localStorage.getItem(BONUS_KEY));
      if (!saved || saved.cycleId !== CURRENT_CYCLE_ID) {
        // Different or missing cycle -> reset
        return { cycleId: CURRENT_CYCLE_ID, ready: false, spinUsed: false };
      }
      return saved;
    } catch { 
      return { cycleId: CURRENT_CYCLE_ID, ready: false, spinUsed: false };
    }
  }

  const initialBonus = readBonusState();

  const [bonusReady, setBonusReady] = useState(initialBonus.ready);
  const [spinUsed,   setSpinUsed]   = useState(initialBonus.spinUsed);
  const [bonusOpen,  setBonusOpen]  = useState(false);
  const [spinning,   setSpinning]   = useState(false);
  const [reels,      setReels]      = useState([0,1,2,3,4]);
  const [winMsg,     setWinMsg]     = useState("");
  const [gameUnlockGuard, setGameUnlockGuard] = useState(false);
  const [bonusPushNotification, setBonusPushNotification] = useState(null); // {count, pushId}

  function persistBonusState(ready, used) {
    try {
      localStorage.setItem(BONUS_KEY, JSON.stringify({
        cycleId: CURRENT_CYCLE_ID,
        ready, spinUsed: used
      }));
    } catch(e) { console.warn('persist bonus failed', e); }
  }

  const videoRef=useRef(null), canvasRef=useRef(null), loopRef=useRef(null), streamRef=useRef(null);

  // Expose openBonusModal method to parent via ref
  React.useImperativeHandle(ref, () => ({
    openBonusModal: () => {
      // Open bonus modal using admin-pushed spins
      if (remainingBonusSpins > 0) {
        setBonusOpen(true);
        setWinMsg("");
        setReels([0,1,2,3,4]);
      }
    }
  }));
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

  /* Auto-reset bonus if Admin bumps the cycle while this tab is open */
  useEffect(() => {
    function onStorage(e) {
      if (e.key === "__gnome_cycle_id") {
        const newId = localStorage.getItem("__gnome_cycle_id");
        if (newId && newId !== CURRENT_CYCLE_ID) {
          // Reset local state for the new cycle
          setBonusReady(false);
          setSpinUsed(false);
          try {
            localStorage.setItem(BONUS_KEY, JSON.stringify({
              cycleId: newId, ready: false, spinUsed: false
            }));
          } catch {}
          // Optional: toast the user "New hunt cycle started!"
        }
      }
      
      // Listen for bonus push events from Admin
      if (e.key === "__bonus_push") {
        try {
          const pushData = JSON.parse(e.newValue);
          if (pushData && pushData.count > 0) {
            // Check if we've already seen this push
            const lastPushId = localStorage.getItem("__last_bonus_push_id");
            if (lastPushId !== pushData.pushId) {
              // New bonus push! Show fireworks celebration
              setBonusPushNotification(pushData);
              localStorage.setItem("__last_bonus_push_id", pushData.pushId);
              window.GV.celebrateRain();
            }
          }
        } catch {}
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Poll for bonus campaigns and countdown timer
  useEffect(() => {
    function checkCampaign() {
      try {
        // Check for active campaign
        let campaignData = JSON.parse(localStorage.getItem("__bonus_campaign"));
        
        // Check cookie as fallback
        if (!campaignData) {
          const cookies = document.cookie.split(';');
          const campaignCookie = cookies.find(c => c.trim().startsWith('__bonus_campaign='));
          if (campaignCookie) {
            try {
              const cookieValue = decodeURIComponent(campaignCookie.split('=')[1]);
              campaignData = JSON.parse(cookieValue);
              if (campaignData) {
                localStorage.setItem("__bonus_campaign", JSON.stringify(campaignData));
              }
            } catch(e) {
              console.warn('Failed to parse campaign cookie', e);
            }
          }
        }
        
        if (campaignData) {
          const now = Date.now();
          const timeLeft = Math.max(0, campaignData.endTime - now);
          
          if (timeLeft > 0) {
            // Campaign is active
            setBonusCampaign(campaignData);
            setCampaignTimeLeft(timeLeft);
          } else {
            // Campaign expired - clear it and expire spins
            setBonusCampaign(null);
            setCampaignTimeLeft(0);
            localStorage.removeItem("__bonus_campaign");
            
            // Clear expired spins
            const bonusData = JSON.parse(localStorage.getItem(BONUS_SPINS_KEY) || '{}');
            if (bonusData.campaignId === campaignData.pushId) {
              bonusData.remaining = 0;
              bonusData.campaignExpiry = null;
              bonusData.campaignId = null;
              localStorage.setItem(BONUS_SPINS_KEY, JSON.stringify(bonusData));
              setRemainingBonusSpins(0);
            }
          }
        } else {
          setBonusCampaign(null);
          setCampaignTimeLeft(0);
        }
        
        // Also check current bonus spins count
        const bonusData = JSON.parse(localStorage.getItem(BONUS_SPINS_KEY));
        console.log('Checking bonus spins:', BONUS_SPINS_KEY, bonusData, 'current:', remainingBonusSpins);
        if (bonusData && bonusData.remaining !== remainingBonusSpins) {
          console.log('Updating bonus spins from', remainingBonusSpins, 'to', bonusData.remaining);
          setRemainingBonusSpins(bonusData.remaining || 0);
        }
      } catch(e) {
        console.warn('Error checking campaign:', e);
      }
    }
    
    // Check immediately on mount
    checkCampaign();
    
    // Poll every second for campaign updates and countdown
    const interval = setInterval(checkCampaign, 1000);
    
    return () => clearInterval(interval);
  }, [remainingBonusSpins, BONUS_SPINS_KEY]);

  // Poll for bonus pushes every second (storage events don't fire in same tab)
  useEffect(() => {
    function checkBonusPush() {
      try {
        // Check localStorage first
        let pushData = JSON.parse(localStorage.getItem("__bonus_push"));
        
        // If not found, check cookie (for cross-subdomain/cross-tab support)
        if (!pushData) {
          const cookies = document.cookie.split(';');
          const bonusCookie = cookies.find(c => c.trim().startsWith('__bonus_push='));
          if (bonusCookie) {
            try {
              const cookieValue = decodeURIComponent(bonusCookie.split('=')[1]);
              pushData = JSON.parse(cookieValue);
              // Copy to localStorage for future reference
              if (pushData) {
                localStorage.setItem("__bonus_push", JSON.stringify(pushData));
              }
            } catch(e) {
              console.warn('Failed to parse bonus cookie', e);
            }
          }
        }
        
        if (pushData && pushData.count > 0) {
          const lastPushId = localStorage.getItem("__last_bonus_push_id");
          if (lastPushId !== pushData.pushId) {
            setBonusPushNotification(pushData);
            localStorage.setItem("__last_bonus_push_id", pushData.pushId);
            window.GV.celebrateRain();
          }
        }
      } catch(e) {
        console.warn('Error checking bonus push:', e);
      }
    }
    
    // Check immediately on mount
    checkBonusPush();
    
    // Poll every second for new pushes
    const interval = setInterval(checkBonusPush, 1000);
    
    return () => clearInterval(interval);
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
    
    // Get the partner/establishment for this gnome
    const gnomeAssignment = window.__gnomeAssignments[gnomeId];
    const partner = gnomeAssignment ? (window.__partners || []).find(p => p.id === gnomeAssignment.partnerId) : null;
    const partnerCity = partner && partner.address ? (() => {
      const parts = partner.address.split(',');
      return parts.length >= 2 ? parts[parts.length - 2].trim() : null;
    })() : null;
    const partnerEstablishment = partner?.establishment || null;
    
    const coupons=(window.__coupons||[]).filter(c=>{
      if(c.blocked) return false;
      const now=Date.now();
      const windowOk=(!c.startAt||now>=c.startAt)&&(!c.endAt||now<=c.endAt);
      const capOk=!(c.scanCap>0 && (c.unlocks||0)>=c.scanCap);
      const active=c.active&&windowOk&&capOk;
      if(!active) return false;
      
      // Check gnome targeting
      if(c.target==='one' && c.gnomeId !== gnomeId) return false;
      if(c.target==='golden'&&window.__goldenScheduled && window.__goldenScheduled.gnomeId !== gnomeId) return false;
      // c.target === 'all' passes through
      
      // Check city filter
      if(c.cityFilter && c.cityFilter !== 'all') {
        if(!partnerCity || c.cityFilter !== partnerCity) return false;
      }
      
      // Check establishment filter
      if(c.establishmentFilter && c.establishmentFilter !== 'all') {
        if(!partnerEstablishment || c.establishmentFilter !== partnerEstablishment) return false;
      }
      
      return true;
    });

    for(const c of coupons){
      const key=`${window.__cycleId}|${window.GV.DEVICE_ID}|${c.id}|${gnomeId}`;
      if(window.__deviceCouponGrants[key]) continue;

      if(!c.system){ // advertiser pay-per-unlock
        const adv=(window.__advertisers||[]).find(a=>a.id===c.advertiserId);
        if(adv?.freeAdvertising) {
          // Free advertising - no charge
        } else if(!(adv && adv.cardOnFile) || adv.blocked) {
          continue; // Skip if no card on file (unless free advertising)
        } else {
          // Charge for unlock
          window.__charges.push({
            type:'advertiser',
            advertiserId:adv.id,
            amount:window.__costPerUnlock,
            ts:Date.now(),
            note:`Unlock ${c.title}`,
            deviceId:window.GV.DEVICE_ID,
            gnomeId
          });
        }
        
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
    const foundIds = found.map(f => f.gnomeId);
    if(!foundIds.includes(gnomeId)) {
      const newFound = [...found, {gnomeId, method: 'trigger', ts: Date.now()}];
      saveFound(newFound);
    }
    window.__scans.push({gnomeId,ts:Date.now(),deviceId:window.GV.DEVICE_ID,userEmail:user?.email});
    const g = window.GV.GNOMES.find(x=>x.id===gnomeId);
    const unlockedCount=grantOnScan(gnomeId);
    setCelebrate({gnomeId,name:g?.name,image:g?.image});
    try { window.GV.celebrateRain(); } catch(e){}
    setMessage(`Matched trigger for #${gnomeId}. ${unlockedCount>0?`Unlocked ${unlockedCount} coupon(s).`:''}`);
    
    // Enable bonus slot machine (unless it's from the game itself)
    if (!gameUnlockGuard) {
      setBonusReady(true);
      setSpinUsed(false);
      persistBonusState(true, false);
    }
  }

  // --- Gnome Bonus Slot Machine Functions ---
  function openBonus() {
    if (!bonusReady || spinUsed) return;
    setBonusOpen(true);
    setWinMsg("");
    setReels([0,1,2,3,4]); // reset visuals
  }

  function closeBonus() {
    setBonusOpen(false);
    setWinMsg("");
  }

  function randomIndex() {
    return Math.floor(Math.random() * window.GV.GNOMES.length); // 0..9
  }

  function startSpin() {
    if (spinning || remainingBonusSpins === 0) return;
    setSpinning(true);

    // Consume one spin immediately
    const bonusData = JSON.parse(localStorage.getItem(BONUS_SPINS_KEY) || '{}');
    bonusData.remaining = Math.max(0, (bonusData.remaining || 0) - 1);
    localStorage.setItem(BONUS_SPINS_KEY, JSON.stringify(bonusData));
    setRemainingBonusSpins(bonusData.remaining);

    // Decide win/lose: ~1/8 win chance
    const willWin = Math.random() < 0.125;
    let targetIndex = randomIndex();

    // Spin intervals for each reel; stop sequentially for a nice effect
    const localReels = [ ...reels ];
    const timers = [];
    const stops  = [];

    for (let i=0; i<5; i++) {
      const t = setInterval(()=>{
        localReels[i] = randomIndex();
        setReels([ ...localReels ]);
      }, 60 + i*10);
      timers.push(t);
    }

    // Prepare final faces
    let finalFaces;
    if (willWin) {
      finalFaces = [targetIndex,targetIndex,targetIndex,targetIndex,targetIndex];
    } else {
      finalFaces = Array.from({length:5}, ()=>randomIndex());
      // ensure not all the same:
      const allSame = finalFaces.every(x=>x===finalFaces[0]);
      if (allSame) {
        finalFaces[4] = (finalFaces[4] + 1) % window.GV.GNOMES.length;
      }
    }

    // Stop each reel with a stagger
    for (let i=0; i<5; i++) {
      const st = setTimeout(()=>{
        clearInterval(timers[i]);
        localReels[i] = finalFaces[i];
        setReels([ ...localReels ]);
        // after all stopped, resolve result
        if (i===4) {
          setTimeout(()=>{
            const centerSame = (new Set(finalFaces)).size === 1;
            if (centerSame) {
              const winGnome = window.GV.GNOMES[ finalFaces[0] ];
              setWinMsg("NEW GNOME UNLOCKED!");
              try { window.GV.celebrateRain(); } catch(e){}
              // unlock that gnome & its coupons
              setGameUnlockGuard(true);
              onGnomeMatched(winGnome.id);
              setGameUnlockGuard(false);
              // Close modal after celebration
              setTimeout(()=>{
                closeBonus();
              }, 1200);
            } else {
              setWinMsg("No match — better luck next time!");
              // Auto-close after 2 seconds on loss
              setTimeout(()=>{
                closeBonus();
              }, 2000);
            }
            setSpinning(false);
          }, 300);
        }
      }, 900 + i*550);
      stops.push(st);
    }
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
    alert("Redeemed successfully! Show this code at the establishment.");
  }

  // === HUNTING MODE FUNCTIONS ===
  async function startHuntingMode(){
    try{
      const constraints={video:{facingMode:"environment"}};
      const stream=await navigator.mediaDevices.getUserMedia(constraints);
      huntingStreamRef.current=stream;
      setHuntingMode(true);
      setTimeout(startHuntingScanLoop,30);
    }catch(e){ 
      alert("Camera access denied or unavailable."); 
    }
  }

  function stopHuntingMode(){
    cancelAnimationFrame(animationFrameRef.current);
    if(huntingStreamRef.current){ 
      huntingStreamRef.current.getTracks().forEach(t=>t.stop()); 
      huntingStreamRef.current=null; 
    }
    setHuntingMode(false);
    setGnomeSpotted(null);
    setGnomeRunning(false);
    setShotFired(false);
    setCaptureSuccess(null);
  }

  function startHuntingScanLoop(){
    const video=huntingVideoRef.current;
    const canvas=huntingCanvasRef.current;
    if(!video||!canvas) return;
    
    video.srcObject=huntingStreamRef.current;
    video.setAttribute('playsinline',true);
    video.play();
    
    const ctx=canvas.getContext('2d');
    const targetList = Object.entries(window.__triggerImages||{})
      .map(([gid,obj])=>({gnomeId:Number(gid),hash:obj.aHash}))
      .filter(t=>!!t.hash);
    const THRESHOLD = 10;

    const tick=()=>{
      if(video.readyState===video.HAVE_ENOUGH_DATA){
        // Check if gnome is already spotted and running
        if(!gnomeRunning){
          // Scan for trigger image
          const size=8;
          canvas.width=size; canvas.height=size;
          ctx.drawImage(video,0,0,size,size);
          const data=ctx.getImageData(0,0,size,size).data;
          
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
            const a = frameHash ^ t.hash;
            let bits=a, count=0;
            while(bits){ count++; bits &= (bits-1n); }
            if(count <= THRESHOLD){
              // Trigger detected! Spawn running gnome
              const gnome = window.GV.GNOMES.find(g=>g.id===t.gnomeId);
              if(gnome && !found.find(f=>f.gnomeId===gnome.id)){
                spawnRunningGnome(gnome);
              }
              break;
            }
          }
        }
      }
      animationFrameRef.current=requestAnimationFrame(tick);
    };
    animationFrameRef.current=requestAnimationFrame(tick);
  }

  function spawnRunningGnome(gnome){
    // Start gnome at random edge position
    const edges = [
      {x: Math.random()*100, y: -5}, // top
      {x: Math.random()*100, y: 105}, // bottom
      {x: -5, y: Math.random()*100}, // left
      {x: 105, y: Math.random()*100} // right
    ];
    const startPos = edges[Math.floor(Math.random()*edges.length)];
    
    gnomePositionRef.current = startPos;
    
    // Random direction toward center with some variance
    const centerX = 50, centerY = 50;
    const dx = (centerX - startPos.x) * 0.02 + (Math.random()-0.5)*2;
    const dy = (centerY - startPos.y) * 0.02 + (Math.random()-0.5)*2;
    gnomeDirectionRef.current = {dx, dy};
    
    setGnomeSpotted(gnome);
    setGnomeRunning(true);
    setGnomeShootingBack(false);
    
    // After 10 seconds, gnome starts shooting back
    gnomeShootTimerRef.current = setTimeout(() => {
      setGnomeShootingBack(true);
      startGnomeShooting();
    }, 10000);
    
    // Start gnome movement animation
    animateGnomeMovement();
  }
  
  function startGnomeShooting() {
    // Gnome shoots every 2 seconds
    const shootInterval = setInterval(() => {
      if (!gnomeRunning || shieldStrength <= 0) {
        clearInterval(shootInterval);
        return;
      }
      
      // Fire gnome projectile
      setGnomeProjectileFired(true);
      
      // Random chance to hit player (30% chance)
      setTimeout(() => {
        if (Math.random() < 0.3) {
          // Hit! Reduce shield by 25%
          setShieldStrength(prev => Math.max(0, prev - 25));
        }
        setGnomeProjectileFired(false);
      }, 800);
      
    }, 2000);
    
    // Store interval ref to clean up
    gnomeShootTimerRef.current = shootInterval;
  }

  function animateGnomeMovement(){
    const speed = 1.5; // base speed multiplier
    
    const move = ()=>{
      if(!gnomeRunning) return;
      
      const pos = gnomePositionRef.current;
      const dir = gnomeDirectionRef.current;
      
      // Update position
      pos.x += dir.dx * speed;
      pos.y += dir.dy * speed;
      
      // Bounce off edges and change direction randomly
      if(pos.x < 0 || pos.x > 100){
        dir.dx = -dir.dx + (Math.random()-0.5)*0.5;
        pos.x = Math.max(0, Math.min(100, pos.x));
      }
      if(pos.y < 0 || pos.y > 100){
        dir.dy = -dir.dy + (Math.random()-0.5)*0.5;
        pos.y = Math.max(0, Math.min(100, pos.y));
      }
      
      // Random direction changes
      if(Math.random() < 0.02){
        dir.dx += (Math.random()-0.5)*1;
        dir.dy += (Math.random()-0.5)*1;
      }
      
      gnomePositionRef.current = {...pos};
      gnomeDirectionRef.current = {...dir};
      
      // Force re-render to update gnome position
      setGnomeSpotted(prev => prev ? {...prev} : null);
      
      setTimeout(move, 50); // ~20 FPS for smooth movement
    };
    
    move();
  }

  function fireWeapon(){
    if(shotFired) return;
    
    // Check shield strength - no shooting if depleted
    if(shieldStrength <= 0){
      setCaptureSuccess(null);
      setTimeout(() => {
        setCaptureSuccess(null);
      }, 2000);
      return;
    }
    
    setShotFired(true);
    
    // Flash power meter
    setPowerFlash(true);
    setTimeout(() => setPowerFlash(false), 300);
    
    // If no gnome, just practice shooting
    if(!gnomeRunning){
      // Show practice shot feedback
      setTimeout(()=>{
        setShotFired(false);
      }, 800);
      return;
    }
    
    // Check if crosshair (center) is near gnome position
    const gnomePos = gnomePositionRef.current;
    const centerX = 50, centerY = 50;
    
    // Calculate distance from center (crosshair) to gnome
    const distance = Math.sqrt(
      Math.pow(gnomePos.x - centerX, 2) + 
      Math.pow(gnomePos.y - centerY, 2)
    );
    
    // Hit detection - closer = easier to hit, weapon affects hit radius
    const hitRadius = {
      net: 15,      // Easiest - wide net
      dart: 8,      // Harder - precise
      shortbow: 10, // Medium
      crossbow: 12  // Medium-easy
    }[selectedWeapon] || 10;
    
    setTimeout(()=>{
      if(distance < hitRadius){
        // HIT! Capture successful
        setCaptureSuccess(true);
        setGnomeRunning(false);
        setGnomeShootingBack(false);
        if(gnomeShootTimerRef.current) {
          clearTimeout(gnomeShootTimerRef.current);
          gnomeShootTimerRef.current = null;
        }
        
        // Unlock the gnome and restore shield to 100%
        setTimeout(()=>{
          onGnomeMatched(gnomeSpotted.gnomeId);
          setShieldStrength(100);
          stopHuntingMode();
        }, 1500);
      } else {
        // MISS! Gnome escapes
        setCaptureSuccess(false);
        setTimeout(()=>{
          setGnomeRunning(false);
          setGnomeSpotted(null);
          setShotFired(false);
          setCaptureSuccess(null);
          setGnomeShootingBack(false);
          if(gnomeShootTimerRef.current) {
            clearTimeout(gnomeShootTimerRef.current);
            gnomeShootTimerRef.current = null;
          }
        }, 1500);
      }
    }, 500); // Delay for weapon animation
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
      
      const {lat,lng}=window.GV.addrToLatLng(p.address||'', p); // Pass partner object for exact coordinates
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
      
      const {lat,lng}=window.GV.addrToLatLng(p.address||'', p); // Pass partner object for exact coordinates
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
      
      {/* Dark Mode Toggle for Nighttime Adventures */}
      <div className={`rounded-2xl border-2 p-3 transition-all ${
        darkMode 
          ? 'neon-card-purple border-purple-500' 
          : 'border-indigo-300 bg-gradient-to-r from-indigo-50 to-purple-50'
      }`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{darkMode ? '🌙' : '☀️'}</span>
            <div>
              <h3 className={`font-bold text-sm mb-0.5 ${darkMode ? 'text-cyan-300' : 'text-indigo-900'}`}>
                {darkMode ? 'Night Mode Active' : 'Daytime Theme'}
              </h3>
              <p className={`text-xs ${darkMode ? 'text-purple-300' : 'text-indigo-700'}`}>
                {darkMode ? 'Neon glow effects for nighttime adventures' : 'Switch to night mode for better visibility'}
              </p>
            </div>
          </div>
          <button
            className={`rounded-xl px-4 py-2 text-sm font-bold transition-all ${
              darkMode 
                ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white shadow-lg shadow-purple-500/50 hover:shadow-purple-500/70' 
                : 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white hover:from-yellow-500 hover:to-orange-600'
            }`}
            onClick={() => setDarkMode(!darkMode)}
          >
            {darkMode ? '🌙 Night' : '☀️ Day'}
          </button>
        </div>
      </div>
      
      {/* Bonus Spins Campaign Banner */}
      {bonusCampaign && campaignTimeLeft > 0 && remainingBonusSpins > 0 && (
        <div className={`rounded-2xl border-2 p-4 ${
          darkMode
            ? 'neon-card-pink border-pink-500 animate-pulse'
            : 'border-yellow-400 bg-gradient-to-r from-yellow-50 via-orange-50 to-yellow-50 animate-pulse'
        }`}>
          <div className="flex items-center gap-3">
            <span className="text-4xl">🎰</span>
            <div className="flex-1">
              <h3 className={`font-bold text-lg mb-1 ${darkMode ? 'text-pink-300' : 'text-yellow-900'}`}>
                {remainingBonusSpins} Gnome Bonus Spins Unlocked!!
              </h3>
              <div className="flex items-center gap-2 text-sm">
                <span className={darkMode ? 'text-purple-300' : 'text-yellow-800'}>Time Remaining:</span>
                <span className={`font-mono font-bold ${darkMode ? 'text-cyan-300' : 'text-orange-700'}`}>
                  {(() => {
                    const hours = Math.floor(campaignTimeLeft / (60 * 60 * 1000));
                    const minutes = Math.floor((campaignTimeLeft % (60 * 60 * 1000)) / (60 * 1000));
                    const seconds = Math.floor((campaignTimeLeft % (60 * 1000)) / 1000);
                    return `${hours}h ${minutes}m ${seconds}s`;
                  })()}
                </span>
              </div>
            </div>
            <button
              onClick={() => {
                setBonusOpen(true);
                setWinMsg("");
                setReels([0,1,2,3,4]);
              }}
              className={`rounded-xl px-6 py-3 font-bold text-lg shadow-lg transform hover:scale-105 transition-transform ${
                darkMode
                  ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-pink-500/50 hover:shadow-pink-500/70'
                  : 'bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white'
              }`}
            >
              🎰 PLAY NOW!
            </button>
          </div>
        </div>
      )}
      
      {/* Progress */}
      <div className={`rounded-2xl border-2 p-4 ${
        darkMode 
          ? 'neon-card border-cyan-500'
          : 'border-indigo-400 bg-gradient-to-br from-indigo-50 to-purple-50'
      }`}>
        <div className="flex items-center gap-3 mb-3">
          <span className="text-3xl">🎯</span>
          <div className="flex-1">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className={`font-semibold text-sm ${darkMode ? 'text-cyan-300' : 'text-indigo-900'}`}>
                Your Progress
              </h3>
              {user && (
                <div className={`text-[11px] ${darkMode ? 'text-purple-300' : 'text-indigo-600'}`}>
                  Signed in as <span className="font-mono font-semibold">{user.email}</span>
                </div>
              )}
            </div>
            <p className={`text-xs mt-1 ${darkMode ? 'text-cyan-200' : 'text-indigo-700'}`}>
              {found.length}/{window.GV.GNOMES.length} gnomes found ({progressPct}% complete)
            </p>
          </div>
        </div>
        
        <div className="mb-3">
          <div className="h-3 w-full rounded-full bg-gray-200 overflow-hidden">
            <div 
              className={`h-3 rounded-full transition-all duration-500 ${
                darkMode 
                  ? 'bg-gradient-to-r from-cyan-500 to-purple-600'
                  : 'bg-gradient-to-r from-indigo-600 to-purple-600'
              }`}
              style={{width:`${progressPct}%`}}
            />
          </div>
        </div>
        
        {/* Color-coded gnome badges */}
        <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
          {window.GV.GNOMES.map(g => {
            const foundItem = found.find(f => f.gnomeId === g.id);
            const isFound = !!foundItem;
            const method = foundItem?.method;
            return (
              <div key={g.id} className="flex flex-col items-center">
                <div className={`w-12 h-12 rounded-lg border-2 flex items-center justify-center transition-all ${
                  method === 'trigger' 
                    ? darkMode 
                      ? 'bg-green-900/50 border-green-400' 
                      : 'bg-green-50 border-green-500'
                    : method === 'slot' 
                      ? darkMode 
                        ? 'bg-blue-900/50 border-blue-400' 
                        : 'bg-blue-50 border-blue-500'
                      : darkMode 
                        ? 'bg-slate-800/50 border-slate-600' 
                        : 'bg-gray-100 border-gray-300'
                }`}>
                  <img 
                    src={g.image} 
                    alt={g.name} 
                    className={`w-10 h-10 object-contain ${
                      !isFound 
                        ? 'opacity-30 grayscale' 
                        : 'float-gnome-sm'
                    }`} 
                  />
                </div>
                <span className={`text-[9px] mt-1 ${
                  darkMode ? 'text-purple-400' : 'text-gray-600'
                }`}>
                  #{g.id}
                </span>
              </div>
            );
          })}
        </div>
        
        <div className="mt-3 flex items-center gap-4 text-[10px] flex-wrap">
          <div className="flex items-center gap-1">
            <div className={`w-3 h-3 rounded ${
              darkMode ? 'bg-green-400' : 'bg-green-500'
            }`}></div>
            <span className={darkMode ? 'text-green-300' : 'text-gray-600'}>Trigger Scan</span>
          </div>
          <div className="flex items-center gap-1">
            <div className={`w-3 h-3 rounded ${
              darkMode ? 'bg-blue-400' : 'bg-blue-500'
            }`}></div>
            <span className={darkMode ? 'text-blue-300' : 'text-gray-600'}>Slot Win</span>
          </div>
          <div className="flex items-center gap-1">
            <div className={`w-3 h-3 rounded ${
              darkMode ? 'bg-slate-600' : 'bg-gray-300'
            }`}></div>
            <span className={darkMode ? 'text-purple-400' : 'text-gray-600'}>Locked</span>
          </div>
        </div>
      </div>

      {/* Game Rewards */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Golden Gnome Reward */}
        <div className={`rounded-2xl border-2 p-4 ${
          darkMode 
            ? 'border-yellow-500 bg-gradient-to-br from-yellow-950/50 to-amber-950/50'
            : 'border-yellow-400 bg-gradient-to-br from-yellow-50 to-amber-50'
        }`}>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-4xl">🏆</span>
            <div className="flex-1">
              <h3 className={`font-bold ${darkMode ? 'text-yellow-300' : 'text-yellow-900'}`}>
                Golden Gnome
              </h3>
              <p className={`text-xs ${darkMode ? 'text-yellow-200' : 'text-yellow-700'}`}>
                Special Event Reward
              </p>
            </div>
            <span className="text-3xl">🔒</span>
          </div>
          <div className={`rounded-lg p-3 border ${
            darkMode 
              ? 'bg-slate-800/50 border-yellow-500/30'
              : 'bg-white border-yellow-300'
          }`}>
            <div className={`font-bold text-lg ${
              darkMode ? 'text-yellow-300' : 'text-yellow-900'
            }`}>
              $2,000 OFF
            </div>
            <div className={`text-sm font-semibold ${
              darkMode ? 'text-yellow-200' : 'text-gray-700'
            }`}>
              at WildFlower FL Dispensary
            </div>
            <div className={`text-xs mt-1 ${
              darkMode ? 'text-yellow-400' : 'text-gray-600'
            }`}>
              Location: 240 S 3rd St, Jacksonville Beach, FL 32250
            </div>
            <div className={`text-[10px] italic mt-0.5 ${
              darkMode ? 'text-yellow-500' : 'text-gray-500'
            }`}>
              "Former Salt Life Retail Store"
            </div>
            <div className={`text-xs mt-2 ${
              darkMode ? 'text-purple-300' : 'text-gray-600'
            }`}>
              Unlocked during special admin events
            </div>
          </div>
        </div>

        {/* Milestone Reward */}
        {(() => {
          const foundIds = found.filter(f => f.method === 'trigger').map(f => f.gnomeId).sort((a,b) => a-b);
          const inOrder = foundIds.length === 10 && foundIds.every((id, idx) => id === idx + 1);
          const isUnlocked = inOrder;
          
          return (
            <div className={`rounded-2xl border-2 p-4 ${
              darkMode 
                ? isUnlocked 
                  ? 'border-purple-500 bg-gradient-to-br from-purple-950/50 to-pink-950/50'
                  : 'border-slate-600 bg-gradient-to-br from-slate-900/50 to-slate-800/50'
                : isUnlocked 
                  ? 'border-purple-400 bg-gradient-to-br from-purple-50 to-pink-50'
                  : 'border-gray-400 bg-gradient-to-br from-gray-50 to-slate-50'
            }`}>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-4xl">🎯</span>
                <div className="flex-1">
                  <h3 className={`font-bold ${
                    darkMode 
                      ? isUnlocked ? 'text-purple-300' : 'text-slate-400'
                      : isUnlocked ? 'text-purple-900' : 'text-gray-700'
                  }`}>
                    Milestone Reward
                  </h3>
                  <p className={`text-xs ${
                    darkMode 
                      ? isUnlocked ? 'text-purple-200' : 'text-slate-500'
                      : isUnlocked ? 'text-purple-700' : 'text-gray-600'
                  }`}>
                    Find all 10 in order (1→10)
                  </p>
                </div>
                <span className="text-3xl">{isUnlocked ? '✅' : '🔒'}</span>
              </div>
              <div className={`rounded-lg p-3 border ${
                darkMode 
                  ? isUnlocked 
                    ? 'bg-slate-800/50 border-purple-500/30'
                    : 'bg-slate-900/50 border-slate-700'
                  : isUnlocked 
                    ? 'bg-white border-purple-300'
                    : 'bg-gray-100 border-gray-300'
              }`}>
                <div className={`font-bold text-lg ${
                  darkMode 
                    ? isUnlocked ? 'text-purple-300' : 'text-slate-500'
                    : isUnlocked ? 'text-purple-900' : 'text-gray-600'
                }`}>
                  $1,000 OFF
                </div>
                <div className={`text-sm font-semibold ${isUnlocked ? 'text-gray-700' : 'text-gray-600'}`}>at WildFlower FL Dispensary</div>
                <div className={`text-xs ${isUnlocked ? 'text-gray-600' : 'text-gray-500'} mt-1`}>Location: 240 S 3rd St, Jacksonville Beach, FL 32250</div>
                <div className={`text-[10px] italic ${isUnlocked ? 'text-gray-500' : 'text-gray-400'} mt-0.5`}>"Former Salt Life Retail Store"</div>
                {isUnlocked ? (
                  <div className="text-xs text-green-700 mt-2 font-semibold">🎉 UNLOCKED! Code: MLS-{window.GV.DEVICE_ID.slice(-6).toUpperCase()}</div>
                ) : (
                  <div className="text-xs text-gray-600 mt-2">
                    Next: Find #{foundIds.length + 1} via trigger scan
                    <br/>
                    <span className="text-[10px] text-gray-500">(Slot wins don't count toward order)</span>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Clues */}
      <div className={`rounded-2xl border-2 p-4 ${
        darkMode 
          ? 'neon-card-purple border-purple-500'
          : 'border-green-400 bg-gradient-to-br from-green-50 to-emerald-50'
      }`}>
        <div className="flex items-center gap-3 mb-3">
          <span className="text-3xl">🗺️</span>
          <div className="flex-1">
            <h3 className={`font-semibold text-sm ${
              darkMode ? 'text-cyan-300' : 'text-green-900'
            }`}>
              Current Clues
            </h3>
            <p className={`text-xs ${darkMode ? 'text-purple-300' : 'text-green-700'}`}>
              Solve riddles to find active gnomes at partner locations
            </p>
          </div>
        </div>
        
        <div className="grid md:grid-cols-2 gap-3 text-xs">
          {clues.map(({gnome,active,riddle,hint,partner})=>(
            <div key={gnome.id} className={`rounded-xl border p-3 ${
              darkMode 
                ? 'bg-slate-800/50 border-purple-500/30'
                : 'bg-white border-green-200'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <img src={gnome.image} className="w-8 h-8 object-contain float-gnome-sm" alt=""/>
                <div className={`font-semibold ${darkMode ? 'text-cyan-300' : 'text-gray-900'}`}>
                  #{gnome.id} {gnome.name}
                </div>
                <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full border font-semibold ${
                  active 
                    ? darkMode 
                      ? 'bg-green-500/20 border-green-500 text-green-400'
                      : 'bg-green-50 border-green-500 text-green-700'
                    : darkMode 
                      ? 'bg-slate-700 border-slate-600 text-slate-400'
                      : 'bg-gray-50 border-gray-400 text-gray-600'
                }`}>
                  {active?'Active':'Unavailable'}
                </span>
              </div>
              {active?<>
                <div className={`mt-1 italic ${
                  darkMode ? 'text-purple-200' : 'text-gray-700'
                }`}>
                  "{riddle}"
                </div>
                <div className={`mt-2 text-[11px] ${
                  darkMode ? 'text-cyan-300' : 'text-green-600'
                }`}>
                  💡 Tip: Use your camera to scan the correct logo/image when you arrive.
                </div>
                {hint && (
                  <div className={`mt-2 p-2 rounded-lg ${
                    darkMode 
                      ? 'bg-yellow-900/30 border border-yellow-500/30 text-yellow-300'
                      : 'bg-yellow-50 border border-yellow-300 text-yellow-900'
                  }`}>
                    <span className="font-semibold">🔍 Hint:</span> {hint}
                  </div>
                )}
                {partner && (
                  <div className={`mt-2 text-[11px] ${
                    darkMode ? 'text-purple-400' : 'text-gray-500'
                  }`}>
                    📍 Hosted by: <span className="font-mono font-semibold">{partner.establishment||partner.name}</span>
                  </div>
                )}
              </>:(
                <div className={`mt-1 ${
                  darkMode ? 'text-slate-400' : 'text-gray-500'
                }`}>
                  Waiting for winning Partner to activate.
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Hunting Mode - Featured Section */}
      <div className={`rounded-2xl border-2 p-4 ${
        darkMode 
          ? 'neon-card border-orange-500 bg-gradient-to-br from-orange-900/20 to-red-900/20' 
          : 'border-orange-400 bg-gradient-to-br from-orange-50 to-red-50'
      }`}>
        <div className="flex items-center gap-3 mb-3">
          <span className="text-4xl">🎯</span>
          <div className="flex-1">
            <h3 className={`font-bold text-lg mb-1 ${
              darkMode ? 'text-orange-300' : 'text-orange-900'
            }`}>
              AR Hunting Mode
            </h3>
            <p className={`text-xs ${darkMode ? 'text-orange-200' : 'text-orange-700'}`}>
              Scan trigger images to spawn running gnomes, then aim and shoot to capture them. Practice your aim anytime!
            </p>
          </div>
        </div>
        <button 
          className={`w-full rounded-xl px-8 py-4 text-lg font-black transform hover:scale-105 transition-all ${
            darkMode 
              ? 'bg-gradient-to-r from-yellow-500 to-amber-600 text-gray-900 shadow-2xl shadow-yellow-500/50 hover:shadow-yellow-500/70'
              : 'bg-gradient-to-r from-yellow-400 to-amber-500 text-gray-900 shadow-xl shadow-yellow-500/30 hover:shadow-yellow-500/50'
          }`}
          style={{textShadow: '1px 1px 2px rgba(255,255,255,0.3)'}}
          onClick={startHuntingMode}
        >
          🎯 START GNOME HUNTING! 🏹
        </button>
      </div>

      {/* Scanner */}
      <div className={`rounded-2xl border-2 p-4 ${
        darkMode 
          ? 'neon-card border-cyan-500'
          : 'border-blue-400 bg-gradient-to-br from-blue-50 to-cyan-50'
      }`}>
        <div className="flex items-center gap-3 mb-3">
          <span className="text-3xl">📸</span>
          <div className="flex-1">
            <h3 className={`font-semibold text-sm ${
              darkMode ? 'text-cyan-300' : 'text-blue-900'
            }`}>
              Scan Hidden Emblem
            </h3>
            <p className={`text-xs ${darkMode ? 'text-cyan-200' : 'text-blue-700'}`}>
              {/* Fun motivational messages based on progress */}
              {(() => {
                const total = found.length;
                if (total === 0) return "Ready to start your adventure? Point your camera and unlock!";
                if (total === 1) return "Great start! The hunt is on - 9 more to go! 🎯";
                if (total < 5) return `You're on fire! ${10 - total} gnomes left to find! 🔥`;
                if (total < 8) return `Amazing progress! Only ${10 - total} remaining! ⭐`;
                if (total < 10) return `So close! Just ${10 - total} more for the grand prize! 👑`;
                return "You're a legend! All gnomes found! 🏆";
              })()}
            </p>
          </div>
        </div>
        
        <div className="flex gap-3 flex-wrap">
          <button 
            className={`rounded-xl px-6 py-2.5 text-sm font-bold transform hover:scale-105 transition-transform ${
              darkMode 
                ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white shadow-lg shadow-cyan-500/50 animate-pulse'
                : 'bg-black text-white hover:bg-gray-800'
            }`}
            onClick={()=>{setScanMode('image'); openScanner();}}
          >
            🔓 Image Unlock
          </button>
          <button 
            className={`rounded-xl px-6 py-2.5 text-sm font-bold transform hover:scale-105 transition-transform ${
              darkMode 
                ? 'bg-gradient-to-r from-purple-500 to-fuchsia-600 text-white shadow-lg shadow-purple-500/50'
                : 'bg-gradient-to-r from-purple-600 to-fuchsia-700 text-white shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50'
            }`}
            onClick={()=>{setScanMode('qr'); openScanner();}}
          >
            📱 Scan QR for Clue
          </button>
          <button 
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${
              darkMode 
                ? 'border border-purple-500 text-purple-300 hover:bg-purple-900/30'
                : 'border border-blue-300 text-blue-700 hover:bg-blue-50'
            }`}
            onClick={()=>alert('Image Unlock: Point your camera at the correct logo/image at the location. When it matches, your gnome unlocks automatically!\n\nScan QR for Clue: Scan a QR code from a poster to see dynamic clues about which emblem to look for.\n\nHunting Mode: Pokemon GO style AR hunting - scan triggers to spawn gnomes, then aim and shoot!')}
          >
            ❓ Help
          </button>
        </div>
        {message && (
          <p className={`mt-3 text-xs font-semibold animate-bounce ${
            darkMode ? 'text-green-400' : 'text-green-700'
          }`}>
            {message}
          </p>
        )}
      </div>

      {/* Scanner modal */}
      {scanOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="scan-box">
            <video ref={videoRef} style={{width:'100%',height:'auto'}} autoPlay muted playsInline></video>
            <canvas ref={canvasRef} style={{display:'none'}}></canvas>
            <div className="scan-overlay"></div>
            <div className="absolute top-2 right-2"><button className={`rounded px-2 py-1 text-sm font-semibold ${
              darkMode ? 'bg-white/90 text-gray-900' : 'bg-white/90 text-gray-900'
            }`} onClick={closeScanner}>Close</button></div>
            {scanMode==='image' ? (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-white text-xs bg-black/40 rounded px-2 py-1">Scan the correct emblem/logo to unlock.</div>
            ) : (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[90%] bg-white/95 rounded-lg p-3">
                <div className="text-xs font-semibold mb-1 text-gray-900">QR Clue Scanner</div>
                <input type="text" placeholder="Paste GNOME:# code here" id="qrInput" className="w-full border rounded px-2 py-1 text-xs mb-2 text-gray-900"/>
                <button className="w-full rounded bg-emerald-600 text-white px-3 py-1.5 text-xs font-semibold" onClick={()=>{
                  const val=document.getElementById('qrInput').value;
                  showQrClueFromData(val);
                  closeScanner();
                }}>Show Clue</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hunting Mode modal */}
      {huntingMode && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-black overflow-hidden">
            {/* Camera feed - Space view through cockpit */}
            <video ref={huntingVideoRef} className="absolute inset-0 w-full h-full object-cover opacity-50" autoPlay muted playsInline></video>
            <canvas ref={huntingCanvasRef} style={{display:'none'}}></canvas>
            
            {/* Space atmosphere overlay */}
            <div className="absolute inset-0 pointer-events-none z-1" style={{
              background: 'radial-gradient(circle at center, transparent 20%, rgba(0, 10, 30, 0.6) 70%, rgba(0, 5, 20, 0.9) 100%)'
            }}></div>
            
            {/* COCKPIT FRAME OVERLAY */}
            <div className="absolute inset-0 pointer-events-none z-50">
              {/* Top cockpit frame */}
              <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-gray-900 via-gray-800 to-transparent opacity-95"
                   style={{
                     clipPath: 'polygon(0 0, 100% 0, 95% 100%, 5% 100%)',
                     boxShadow: 'inset 0 -10px 30px rgba(0, 0, 0, 0.8)'
                   }}>
                {/* Metal texture lines */}
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-gray-600 to-transparent"></div>
                <div className="absolute inset-x-0 top-2 h-px bg-gradient-to-r from-transparent via-gray-500 to-transparent"></div>
              </div>
              
              {/* Left cockpit frame */}
              <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-gray-900 via-gray-800 to-transparent opacity-95"
                   style={{
                     clipPath: 'polygon(0 0, 100% 10%, 100% 90%, 0 100%)',
                     boxShadow: 'inset -10px 0 30px rgba(0, 0, 0, 0.8)'
                   }}>
                <div className="absolute left-0 inset-y-0 w-1 bg-gradient-to-b from-transparent via-gray-600 to-transparent"></div>
              </div>
              
              {/* Right cockpit frame */}
              <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-gray-900 via-gray-800 to-transparent opacity-95"
                   style={{
                     clipPath: 'polygon(0 10%, 100% 0, 100% 100%, 0 90%)',
                     boxShadow: 'inset 10px 0 30px rgba(0, 0, 0, 0.8)'
                   }}>
                <div className="absolute right-0 inset-y-0 w-1 bg-gradient-to-b from-transparent via-gray-600 to-transparent"></div>
              </div>
              
              {/* Cockpit window frame reflections */}
              <div className="absolute top-16 left-20 w-32 h-1 bg-gradient-to-r from-transparent via-white/20 to-transparent blur-sm"></div>
              <div className="absolute top-24 right-24 w-40 h-1 bg-gradient-to-l from-transparent via-white/15 to-transparent blur-sm"></div>
            </div>
            
            {/* HUD Corner Brackets */}
            <div className="absolute top-20 left-20 w-20 h-20 border-t-2 border-l-2 border-cyan-400 pointer-events-none z-40 animate-pulse" style={{boxShadow: '0 0 15px rgba(6, 182, 212, 0.6)'}}></div>
            <div className="absolute top-20 right-20 w-20 h-20 border-t-2 border-r-2 border-cyan-400 pointer-events-none z-40 animate-pulse" style={{boxShadow: '0 0 15px rgba(6, 182, 212, 0.6)'}}></div>
            <div className="absolute bottom-32 left-20 w-20 h-20 border-b-2 border-l-2 border-cyan-400 pointer-events-none z-40 animate-pulse" style={{boxShadow: '0 0 15px rgba(6, 182, 212, 0.6)'}}></div>
            <div className="absolute bottom-32 right-20 w-20 h-20 border-b-2 border-r-2 border-cyan-400 pointer-events-none z-40 animate-pulse" style={{boxShadow: '0 0 15px rgba(6, 182, 212, 0.6)'}}></div>
            
            {/* HUD Top Bar - Jet Status Display */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-6 px-6 py-2 z-45 pointer-events-none"
                 style={{
                   background: 'linear-gradient(to bottom, rgba(0, 20, 40, 0.8), rgba(0, 10, 20, 0.6))',
                   border: '1px solid rgba(6, 182, 212, 0.3)',
                   borderRadius: '4px',
                   boxShadow: '0 0 20px rgba(6, 182, 212, 0.3), inset 0 0 10px rgba(0, 0, 0, 0.5)'
                 }}>
              <div className="text-cyan-300 text-xs font-bold tracking-wider" style={{textShadow: '0 0 10px rgba(6, 182, 212, 0.8)'}}>
                SPACE JET ALPHA-7
              </div>
              <div className="text-green-400 text-xs font-mono" style={{textShadow: '0 0 10px rgba(74, 222, 128, 0.8)'}}>
                ● SYSTEMS ONLINE
              </div>
            </div>
            
            {/* Top right - Exit button (styled as emergency eject) */}
            <button 
              className="absolute top-4 right-4 bg-red-700/80 hover:bg-red-600 text-white px-4 py-2 rounded text-xs font-bold border border-red-400 z-45 backdrop-blur-sm"
              style={{
                textShadow: '0 0 10px rgba(239, 68, 68, 0.8)',
                boxShadow: '0 0 20px rgba(239, 68, 68, 0.6), inset 0 0 10px rgba(0, 0, 0, 0.3)'
              }}
              onClick={stopHuntingMode}
            >
              ⚠ EJECT
            </button>
            
            {/* Targeting Reticle - Advanced fighter jet style - SMALLER */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-35">
              <div className="relative w-16 h-16">
                {/* Outer rotating ring */}
                <div className="absolute inset-0 rounded-full border-2 border-red-500/30 animate-spin" style={{animationDuration: '4s', boxShadow: '0 0 15px rgba(239, 68, 68, 0.4)'}}></div>
                
                {/* Pulsing scan ring */}
                <div className="absolute inset-0 rounded-full border-2 border-red-400/50 animate-ping" style={{animationDuration: '2s'}}></div>
                
                {/* Main targeting circle */}
                <div className="absolute inset-2 rounded-full border-2 border-red-500" style={{boxShadow: '0 0 20px rgba(239, 68, 68, 0.8), inset 0 0 15px rgba(239, 68, 68, 0.3)'}}></div>
                
                {/* Crosshair lines */}
                <div className="absolute top-1/2 left-0 w-full h-0.5 bg-red-500" style={{boxShadow: '0 0 10px rgba(239, 68, 68, 1)'}}></div>
                <div className="absolute left-1/2 top-0 w-0.5 h-full bg-red-500" style={{boxShadow: '0 0 10px rgba(239, 68, 68, 1)'}}></div>
                
                {/* Corner brackets - smaller */}
                <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-red-400"></div>
                <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-red-400"></div>
                <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-red-400"></div>
                <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-red-400"></div>
                
                {/* Center targeting dot */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-red-500 border border-white" style={{boxShadow: '0 0 15px rgba(239, 68, 68, 1)'}}></div>
                
                {/* Range indicator text - further down to avoid overlap */}
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-red-400 text-[10px] font-mono whitespace-nowrap" style={{textShadow: '0 0 10px rgba(239, 68, 68, 0.8)'}}>
                  RNG: 20FT
                </div>
              </div>
            </div>
            
            {/* Running gnome - Enhanced with neon glow */}
            {gnomeSpotted && gnomeRunning && (
              <img 
                src={gnomeSpotted.image}
                alt="Gnome"
                className="absolute w-24 h-24 object-contain animate-bounce pointer-events-none z-5"
                style={{
                  left: `${gnomePositionRef.current.x}%`,
                  top: `${gnomePositionRef.current.y}%`,
                  transform: 'translate(-50%, -50%)',
                  filter: 'drop-shadow(0 0 20px rgba(255, 255, 0, 1)) drop-shadow(0 0 40px rgba(255, 255, 0, 0.6)) brightness(1.2) contrast(1.1)'
                }}
              />
            )}
            
            {/* Gnome target indicator ring */}
            {gnomeSpotted && gnomeRunning && (
              <div 
                className="absolute w-32 h-32 rounded-full border-4 border-yellow-400 pointer-events-none z-4 animate-pulse"
                style={{
                  left: `${gnomePositionRef.current.x}%`,
                  top: `${gnomePositionRef.current.y}%`,
                  transform: 'translate(-50%, -50%)',
                  boxShadow: '0 0 30px rgba(250, 204, 21, 0.8), inset 0 0 20px rgba(250, 204, 21, 0.3)'
                }}
              ></div>
            )}
            
            {/* COCKPIT DASHBOARD - Bottom controls */}
            <div className="absolute bottom-0 left-0 right-0 z-45 pointer-events-none">
              {/* Dashboard panel background */}
              <div className="relative h-48 bg-gradient-to-t from-gray-900 via-gray-800 to-transparent opacity-95"
                   style={{
                     clipPath: 'polygon(5% 0, 95% 0, 100% 100%, 0 100%)',
                     boxShadow: 'inset 0 20px 40px rgba(0, 0, 0, 0.9)'
                   }}>
                
                {/* Metal panel details */}
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gray-600 to-transparent"></div>
                <div className="absolute inset-x-0 top-2 h-px bg-gradient-to-r from-transparent via-gray-500 to-transparent"></div>
                
                {/* Panel screws */}
                <div className="absolute top-4 left-10 w-2 h-2 rounded-full bg-gray-700 border border-gray-600" style={{boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.8)'}}></div>
                <div className="absolute top-4 right-10 w-2 h-2 rounded-full bg-gray-700 border border-gray-600" style={{boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.8)'}}></div>
                
                {/* Weapon selector - LEFT side of FIRE button */}
                <div className="absolute bottom-16 left-1/2 -translate-x-[220px] pointer-events-auto z-50">
                  <div className="text-cyan-300 text-xs font-bold mb-1 tracking-wider text-center" style={{textShadow: '0 0 10px rgba(6, 182, 212, 0.8)'}}>
                    WEAPON
                  </div>
                  <select 
                    value={selectedWeapon}
                    onChange={(e)=>setSelectedWeapon(e.target.value)}
                    className="bg-gray-900 text-cyan-300 border-2 border-cyan-500 rounded px-4 py-2 text-sm font-mono shadow-xl backdrop-blur-sm font-bold"
                    disabled={gnomeRunning || shieldStrength <= 0}
                    style={{
                      textShadow: '0 0 8px rgba(6, 182, 212, 0.8)',
                      boxShadow: '0 0 25px rgba(6, 182, 212, 0.6), inset 0 0 15px rgba(0, 0, 0, 0.9)'
                    }}
                  >
                    <option value="net">🥅 NET</option>
                    <option value="crossbow">🏹 BOLT</option>
                    <option value="shortbow">🎯 ARROW</option>
                    <option value="dart">🎲 DART</option>
                  </select>
                </div>
                
                {/* Power and Shield meters - RIGHT side of FIRE button */}
                <div className="absolute bottom-16 left-1/2 translate-x-[92px] pointer-events-none z-50">
                  <div className="text-cyan-300 text-xs font-mono mb-2 font-bold" style={{textShadow: '0 0 8px rgba(6, 182, 212, 0.8)'}}>
                    AMMO: {shieldStrength > 0 ? '∞' : '0'}
                  </div>
                  
                  {/* Power meter */}
                  <div className="mb-2">
                    <div className="text-green-400 text-xs font-mono mb-1 font-bold" style={{textShadow: '0 0 10px rgba(74, 222, 128, 0.8)'}}>
                      PWR:
                    </div>
                    <div className="w-32 h-4 bg-gray-900 rounded border-2 border-green-600 overflow-hidden" style={{boxShadow: '0 0 15px rgba(74, 222, 128, 0.4)'}}>
                      <div 
                        className={`h-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-300 ${powerFlash ? 'animate-pulse' : ''}`}
                        style={{
                          width: '100%',
                          boxShadow: powerFlash ? '0 0 20px rgba(74, 222, 128, 1)' : '0 0 10px rgba(74, 222, 128, 0.6)'
                        }}
                      ></div>
                    </div>
                  </div>
                  
                  {/* Shield meter */}
                  <div>
                    <div className={`text-xs font-mono mb-1 font-bold ${shieldStrength > 50 ? 'text-green-400' : shieldStrength > 25 ? 'text-yellow-400' : 'text-red-400'}`} 
                         style={{textShadow: `0 0 10px ${shieldStrength > 50 ? 'rgba(74, 222, 128, 0.8)' : shieldStrength > 25 ? 'rgba(250, 204, 21, 0.8)' : 'rgba(248, 113, 113, 0.8)'}`}}>
                      SHIELD:
                    </div>
                    <div className={`w-32 h-4 bg-gray-900 rounded border-2 overflow-hidden ${
                      shieldStrength > 50 ? 'border-green-600' : shieldStrength > 25 ? 'border-yellow-600' : 'border-red-600'
                    }`} style={{boxShadow: `0 0 15px ${shieldStrength > 50 ? 'rgba(74, 222, 128, 0.4)' : shieldStrength > 25 ? 'rgba(250, 204, 21, 0.4)' : 'rgba(248, 113, 113, 0.4)'}`}}>
                      <div 
                        className={`h-full transition-all duration-500 ${
                          shieldStrength > 50 ? 'bg-gradient-to-r from-green-500 to-green-400' : 
                          shieldStrength > 25 ? 'bg-gradient-to-r from-yellow-500 to-yellow-400' : 
                          'bg-gradient-to-r from-red-500 to-red-400'
                        }`}
                        style={{
                          width: `${shieldStrength}%`,
                          boxShadow: shieldStrength > 0 ? `0 0 15px ${shieldStrength > 50 ? 'rgba(74, 222, 128, 0.8)' : shieldStrength > 25 ? 'rgba(250, 204, 21, 0.8)' : 'rgba(248, 113, 113, 0.8)'}` : 'none'
                        }}
                      ></div>
                    </div>
                    <div className={`text-xs font-mono mt-1 font-bold ${shieldStrength > 50 ? 'text-green-400' : shieldStrength > 25 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {shieldStrength}%
                    </div>
                  </div>
                </div>
                
                {/* Status messages - Above FIRE button */}
                <div className="absolute bottom-52 left-1/2 -translate-x-1/2 text-center pointer-events-none min-w-[250px] z-50">
                  {shieldStrength <= 0 && (
                    <div className="text-red-500 text-lg font-mono font-bold mb-1 animate-pulse" style={{textShadow: '0 0 20px rgba(239, 68, 68, 1)'}}>
                      ⚠️ NO AMMUNITION<br/>
                      <span className="text-sm">SCAN IMAGE TO RESTORE</span>
                    </div>
                  )}
                  
                  {shieldStrength > 0 && !gnomeSpotted && !shotFired && (
                    <div className="text-cyan-300 text-sm font-mono mb-1 animate-pulse" style={{textShadow: '0 0 10px rgba(6, 182, 212, 0.8)'}}>
                      SCANNING...<br/>
                      <span className="text-xs text-cyan-400/80">PRACTICE MODE</span>
                    </div>
                  )}
                  
                  {!gnomeSpotted && shotFired && (
                    <div className="text-orange-400 text-lg font-mono font-bold mb-1 animate-bounce" style={{textShadow: '0 0 20px rgba(249, 115, 22, 1)'}}>
                      {selectedWeapon === 'net' ? '⚡ NET OUT' : selectedWeapon === 'dart' ? '⚡ DART FLY' : selectedWeapon === 'crossbow' ? '⚡ BOLT GO' : '⚡ ARROW FLY'}
                    </div>
                  )}
                  
                  {gnomeSpotted && gnomeRunning && !shotFired && !gnomeShootingBack && (
                    <div className="text-yellow-300 text-lg font-mono font-bold mb-1 animate-pulse" style={{textShadow: '0 0 20px rgba(250, 204, 21, 1)'}}>
                      ⚠️ TARGET LOCKED
                    </div>
                  )}
                  
                  {gnomeShootingBack && (
                    <div className="text-red-400 text-lg font-mono font-bold mb-1 animate-pulse" style={{textShadow: '0 0 20px rgba(248, 113, 113, 1)'}}>
                      🔥 GNOME ATTACKING!
                    </div>
                  )}
                  
                  {captureSuccess === true && (
                    <div className="text-green-400 text-lg font-mono font-bold mb-1 animate-bounce" style={{textShadow: '0 0 20px rgba(74, 222, 128, 1)'}}>
                      ✓ DIRECT HIT!<br/>
                      <span className="text-sm">TARGET DOWN</span>
                    </div>
                  )}
                  
                  {captureSuccess === false && (
                    <div className="text-red-400 text-lg font-mono font-bold mb-1 animate-shake" style={{textShadow: '0 0 20px rgba(248, 113, 113, 1)'}}>
                      ✗ MISS!<br/>
                      <span className="text-sm">ESCAPED</span>
                    </div>
                  )}
                </div>
                
                {/* Center - BIG RED FIRE BUTTON */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 pointer-events-auto">
                  <button 
                    className={`relative rounded-full transition-all ${
                      (!shotFired && shieldStrength > 0)
                        ? 'w-32 h-32 hover:w-36 hover:h-36 active:w-30 active:h-30 ' + (gnomeRunning ? 'animate-pulse' : '')
                        : 'w-32 h-32 cursor-not-allowed'
                    }`}
                    style={{
                      background: (!shotFired && shieldStrength > 0)
                        ? 'radial-gradient(circle at 30% 30%, #ff4444, #cc0000, #990000)'
                        : 'radial-gradient(circle at 30% 30%, #666, #444, #222)',
                      boxShadow: (!shotFired && shieldStrength > 0)
                        ? '0 0 40px rgba(255, 68, 68, 0.8), 0 8px 16px rgba(0, 0, 0, 0.8), inset 0 -8px 16px rgba(0, 0, 0, 0.5), inset 0 2px 8px rgba(255, 100, 100, 0.5)'
                        : '0 0 10px rgba(100, 100, 100, 0.3), inset 0 4px 8px rgba(0, 0, 0, 0.8)',
                      border: (!shotFired && shieldStrength > 0) ? '4px solid #ff6666' : '4px solid #555'
                    }}
                    onClick={fireWeapon}
                    disabled={shotFired || shieldStrength <= 0}
                  >
                    {/* Button highlight */}
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-8 rounded-full opacity-40"
                         style={{background: 'radial-gradient(ellipse, white, transparent)'}}></div>
                    
                    {/* Button text */}
                    <div className="relative z-10 text-white font-black text-xl tracking-wider"
                         style={{textShadow: '0 2px 8px rgba(0, 0, 0, 0.8), 0 0 20px rgba(255, 255, 255, 0.5)'}}>
                      {shieldStrength <= 0 ? 'LOCKED' : 'FIRE'}
                    </div>
                    
                    {/* Status indicator */}
                    {!shotFired && shieldStrength > 0 && (
                      <div className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-green-500 border-2 border-white animate-pulse"
                           style={{boxShadow: '0 0 15px rgba(74, 222, 128, 1)'}}></div>
                    )}
                  </button>
                  
                  {/* Button label */}
                  <div className="text-center mt-2 text-red-400 text-xs font-mono tracking-wider" style={{textShadow: '0 0 10px rgba(239, 68, 68, 0.8)'}}>
                    {shieldStrength <= 0 ? 'OUT OF AMMO' : gnomeRunning ? 'WEAPONS ARMED' : 'TRAINING MODE'}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Weapon fire flash effect */}
            {shotFired && (
              <div className="absolute inset-0 bg-white/30 pointer-events-none z-30 animate-ping" style={{animationDuration: '0.3s', animationIterationCount: '1'}}></div>
            )}
            
            {/* Projectile animation with vapor trail */}
            {shotFired && (
              <>
                {/* Vapor trail effect */}
                <div className="absolute bottom-[5%] left-1/2 -translate-x-1/2 pointer-events-none z-24"
                     style={{
                       width: '4px',
                       height: '50vh',
                       background: `linear-gradient(to top, 
                         ${selectedWeapon === 'net' ? 'rgba(34, 211, 238, 0.4)' : 
                           selectedWeapon === 'crossbow' ? 'rgba(249, 115, 22, 0.4)' : 
                           selectedWeapon === 'shortbow' ? 'rgba(234, 179, 8, 0.4)' : 
                           'rgba(168, 85, 247, 0.4)'} 0%, 
                         transparent 100%)`,
                       filter: 'blur(8px)',
                       opacity: 0.6,
                       animation: 'fade-out 0.8s ease-out forwards'
                     }}
                ></div>
                
                {/* Main projectile */}
                <div className={`projectile ${
                  selectedWeapon === 'net' ? 'net' : 
                  selectedWeapon === 'crossbow' ? 'crossbow-bolt' : 
                  selectedWeapon === 'shortbow' ? 'arrow' : 
                  'dart'
                }`}>
                  {selectedWeapon === 'net' && '🥅'}
                  {selectedWeapon === 'crossbow' && '🏹'}
                  {selectedWeapon === 'shortbow' && '🎯'}
                  {selectedWeapon === 'dart' && '🎲'}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Celebration card */}
      {celebrate && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={()=>setCelebrate(null)}>
          <div className={`w-[90vw] max-w-md rounded-3xl border-4 p-6 text-center transform transition-all scale-100 ${
            darkMode 
              ? 'neon-card-purple border-yellow-500 shadow-2xl shadow-yellow-500/50'
              : 'bg-gradient-to-br from-yellow-100 via-orange-100 to-pink-100 border-yellow-400 shadow-2xl'
          }`} onClick={e=>e.stopPropagation()}>
            {/* Floating emoji decorations */}
            <div className="absolute -top-4 -left-4 text-4xl animate-bounce">🎉</div>
            <div className="absolute -top-4 -right-4 text-4xl animate-bounce delay-100">✨</div>
            <div className="absolute -bottom-4 -left-4 text-4xl animate-bounce delay-200">⭐</div>
            <div className="absolute -bottom-4 -right-4 text-4xl animate-bounce delay-300">🎊</div>
            
            <div className={`text-3xl font-black mb-2 ${
              darkMode ? 'text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-pink-300' : 'text-yellow-900'
            }`}>
              🏆 GNOME UNLOCKED! 🏆
            </div>
            
            <div className={`text-sm mb-4 ${darkMode ? 'text-purple-300' : 'text-orange-700'}`}>
              You found a legendary gnome!
            </div>
            
            <div className="relative">
              <div className="mt-2 flex items-center justify-center">
                <div className={`w-32 h-32 rounded-full flex items-center justify-center ${
                  darkMode 
                    ? 'bg-gradient-to-br from-purple-900 to-pink-900 shadow-lg shadow-purple-500/50'
                    : 'bg-gradient-to-br from-yellow-200 to-orange-200 shadow-lg'
                }`}>
                  <img src={celebrate.image} alt="" className="w-28 h-28 object-contain float-gnome animate-pulse"/>
                </div>
              </div>
              
              <div className={`mt-4 px-4 py-2 rounded-xl inline-block ${
                darkMode 
                  ? 'bg-slate-800/50 border-2 border-cyan-500'
                  : 'bg-white border-2 border-yellow-400'
              }`}>
                <div className={`text-lg font-black ${darkMode ? 'text-cyan-300' : 'text-gray-900'}`}>
                  #{celebrate.gnomeId} {celebrate.name} Gnome
                </div>
              </div>
            </div>
            
            <div className={`mt-4 text-xs ${darkMode ? 'text-purple-300' : 'text-gray-600'}`}>
              +10 XP • Achievement Progress Updated
            </div>
            
            <div className="mt-6 flex gap-3 justify-center">
              <button 
                className={`rounded-xl px-8 py-3 font-bold text-lg transform hover:scale-105 transition-all ${
                  darkMode 
                    ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white shadow-lg shadow-cyan-500/50'
                    : 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white shadow-lg'
                }`}
                onClick={()=>setCelebrate(null)}
              >
                🎉 Awesome!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bonus Push Notification */}
      {bonusPushNotification && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="w-[90vw] max-w-md rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 border-4 border-yellow-400 p-6 text-center shadow-2xl" onClick={e=>e.stopPropagation()}>
            <div className="text-4xl mb-4">🎉🎰🎉</div>
            <div className="text-2xl font-black text-white mb-2">
              You've Earned {bonusPushNotification.count} Gnome Bonus Spin{bonusPushNotification.count > 1 ? 's' : ''}!
            </div>
            <div className="text-sm text-emerald-100 mb-6">
              The admin has gifted you free spins on the slot machine. Try your luck now!
            </div>
            <div className="flex gap-3 justify-center">
              <button 
                className="rounded-lg bg-yellow-400 hover:bg-yellow-300 text-black font-bold px-6 py-3 text-lg shadow-lg transform hover:scale-105 transition"
                onClick={() => {
                  window.location.href = 'https://bonus.gnomeville.app';
                }}
              >
                🎰 Play Now!
              </button>
              <button 
                className="rounded-lg bg-white/20 hover:bg-white/30 text-white px-4 py-3 text-sm"
                onClick={() => setBonusPushNotification(null)}
              >
                Later
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Wallet */}
      <div className={`rounded-2xl border-2 p-4 ${
        darkMode 
          ? 'neon-card-pink border-pink-500'
          : 'border-purple-400 bg-gradient-to-br from-purple-50 to-pink-50'
      }`}>
        <div className="flex items-center gap-3 mb-3">
          <span className="text-3xl">💰</span>
          <div className="flex-1">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className={`font-semibold text-sm ${
                darkMode ? 'text-pink-300' : 'text-purple-900'
              }`}>
                Rewards Wallet
              </h3>
              <span className={`text-[11px] ${
                darkMode ? 'text-purple-400' : 'text-purple-600'
              }`}>
                Codes are device-bound and one-time
              </span>
            </div>
            <p className={`text-xs mt-1 ${
              darkMode ? 'text-purple-300' : 'text-purple-700'
            }`}>
              Your earned coupons and rewards
            </p>
          </div>
        </div>
        
        <div className="grid md:grid-cols-3 gap-3">
          {unlocked.length===0 ? (
            <div className={`col-span-3 text-center py-8 ${
              darkMode ? 'text-purple-400' : 'text-gray-500'
            }`}>
              <span className="text-4xl mb-2 block">🎁</span>
              <p className="text-sm font-semibold">No coupons unlocked yet</p>
              <p className="text-xs mt-1">Find gnomes to unlock exclusive rewards!</p>
            </div>
          ) : (
            unlocked.map((u,i)=>(
              <div key={i} className={`rounded-xl border p-3 ${
                darkMode 
                  ? 'bg-slate-800/50 border-purple-500/30'
                  : 'bg-white border-purple-200'
              }`}>
                <div className={`text-[11px] mb-1 ${
                  darkMode ? 'text-purple-400' : 'text-gray-500'
                }`}>
                  Coupon
                </div>
                <div className={`font-semibold text-sm mb-1 ${
                  darkMode ? 'text-pink-300' : 'text-gray-900'
                }`}>
                  {u.title}
                </div>
                <div className={`text-xs mb-2 ${
                  darkMode ? 'text-purple-300' : 'text-gray-600'
                }`}>
                  {u.desc}
                </div>
                <div className={`text-[11px] mb-1 ${
                  darkMode ? 'text-cyan-400' : 'text-gray-700'
                }`}>
                  Code
                </div>
                <div className={`font-mono text-sm break-all mb-3 px-2 py-1 rounded ${
                  darkMode 
                    ? 'bg-slate-900/50 text-cyan-300'
                    : 'bg-gray-100 text-gray-900'
                }`}>
                  {u.code}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button 
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                      darkMode 
                        ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white'
                        : 'bg-black text-white hover:bg-gray-800'
                    }`}
                    onClick={()=>redeem(u.code)}
                  >
                    ✓ Redeem
                  </button>
                  {window.__walletSubs[window.GV.DEVICE_ID]?.has(u.couponId)
                    ? (
                      <button 
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                          darkMode 
                            ? 'border border-purple-500 text-purple-300'
                            : 'border border-purple-300 text-purple-700'
                        }`}
                        onClick={()=>removeFromWallet(u.couponId)}
                      >
                        Remove from Wallet
                      </button>
                    ) : (
                      <button 
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                          darkMode 
                            ? 'border border-cyan-500 text-cyan-300'
                            : 'border border-blue-300 text-blue-700'
                        }`}
                        onClick={()=>addToWallet(u.couponId)}
                      >
                        Add to Wallet
                      </button>
                    )}
                </div>
              </div>
            ))
          )}
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
      <div className={`rounded-2xl border-2 p-4 ${
        darkMode 
          ? 'neon-card-pink border-pink-500'
          : 'border-orange-400 bg-gradient-to-br from-orange-50 to-red-50'
      }`}>
        <div className="flex items-center gap-3 mb-3">
          <span className="text-3xl">🗺️</span>
          <div className="flex-1">
            <h3 className={`font-semibold text-sm ${
              darkMode ? 'text-pink-300' : 'text-orange-900'
            }`}>
              Live Map & Nearby Gnomes
            </h3>
            <p className={`text-xs ${darkMode ? 'text-purple-300' : 'text-orange-700'}`}>
              Active gnomes appear at Partner addresses. Your dot is shared so players can meet up.
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <label className="flex items-center gap-2">
            <span className={`text-xs font-semibold ${
              darkMode ? 'text-cyan-300' : 'text-gray-700'
            }`}>
              Your Gender
            </span>
            <select 
              className={`border rounded px-3 py-1.5 text-sm ${
                darkMode 
                  ? 'bg-slate-800 text-white border-pink-500'
                  : ''
              }`}
              value={gender} 
              onChange={e=>setGender(e.target.value)}
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </label>
          {!mapOn ? (
            <button 
              className={`rounded-xl px-6 py-2 text-sm font-bold ${
                darkMode 
                  ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg shadow-pink-500/50'
                  : 'bg-black text-white hover:bg-gray-800'
              }`}
              onClick={enableMap}
            >
              📍 Enable Location
            </button>
          ) : (
            <button 
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                darkMode 
                  ? 'border border-purple-500 text-purple-300 hover:bg-purple-900/30'
                  : 'border border-orange-300 text-orange-700 hover:bg-orange-50'
              }`}
              onClick={disableMap}
            >
              ⏹️ Disable
            </button>
          )}
        </div>
        
        {mapOn ? (
          <div id="map" className={`rounded-xl overflow-hidden ${
            darkMode ? 'ring-2 ring-pink-500/50' : ''
          }`}></div>
        ) : (
          <div className={`text-center py-8 ${
            darkMode ? 'text-purple-400' : 'text-gray-500'
          }`}>
            <span className="text-4xl mb-2 block">📍</span>
            <p className="text-sm font-semibold">Location is off</p>
            <p className="text-xs mt-1">Enable location to see gnomes on the map</p>
          </div>
        )}
      </div>

      {/* Bonus Slot Machine Modal */}
      {bonusOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={closeBonus}>
          <div className={`rounded-3xl shadow-2xl max-w-md w-full p-6 relative ${
            darkMode
              ? 'neon-card-purple border-2 border-purple-500'
              : 'bg-gradient-to-br from-yellow-100 via-yellow-50 to-orange-100'
          }`} onClick={(e) => e.stopPropagation()}>
            <button 
              className={`absolute top-4 right-4 text-2xl hover:scale-110 transition-transform ${
                darkMode ? 'text-cyan-300 hover:text-white' : 'text-gray-500 hover:text-black'
              }`}
              onClick={closeBonus}
            >
              ✕
            </button>
            
            <div className="text-center mb-6">
              <h2 className={`text-3xl font-black mb-2 ${darkMode ? 'text-cyan-300' : ''}`}>🎰 Gnome Bonus!</h2>
              <p className={`text-sm ${darkMode ? 'text-purple-300' : 'text-gray-700'}`}>
                Match 5 gnomes to unlock a new one!
              </p>
              <div className={`mt-2 text-xs ${darkMode ? 'text-pink-300' : 'text-gray-600'}`}>
                Spins remaining: <span className="font-bold text-lg">{remainingBonusSpins}</span>
              </div>
            </div>

            {/* Slot Machine Reels */}
            <div className={`rounded-2xl p-6 mb-6 shadow-inner ${
              darkMode
                ? 'bg-gradient-to-b from-slate-900 to-purple-900 border border-cyan-500/30'
                : 'bg-gradient-to-b from-purple-900 to-indigo-900'
            }`}>
              <div className="flex justify-center gap-2 mb-4">
                {reels.map((idx, i) => {
                  const gnome = window.GV.GNOMES[idx];
                  return (
                    <div key={i} className={`rounded-lg p-2 w-16 h-20 flex items-center justify-center shadow-lg ${
                      darkMode ? 'bg-slate-800 border border-purple-400' : 'bg-white'
                    }`}>
                      <img src={gnome.image} alt={gnome.name} className="w-12 h-12 object-contain float-gnome-sm" />
                    </div>
                  );
                })}
              </div>
              
              {winMsg && (
                <div className={`text-center font-bold text-lg mb-3 ${winMsg.includes('UNLOCKED') ? 'text-yellow-300' : 'text-red-300'}`}>
                  {winMsg}
                </div>
              )}

              <button
                className={`w-full rounded-xl py-3 px-6 font-bold text-lg transition-all ${
                  spinning || remainingBonusSpins === 0
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white shadow-lg'
                }`}
                onClick={startSpin}
                disabled={spinning || remainingBonusSpins === 0}
              >
                {spinning ? '🎰 SPINNING...' : remainingBonusSpins > 0 ? '🎰 SPIN!' : 'No Spins Left'}
              </button>
            </div>

            <div className="text-center text-xs text-gray-600">
              <p>Admin pushes bonus spins when new gnomes are added!</p>
              <p className="mt-1">~12.5% chance to win each spin</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

/* =============================================================================
   ADVERTISER COMPONENT
============================================================================= */
function Advertiser({user, darkMode}){
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
  const [cityFilter,setCityFilter]=useState("all"); // "all" or specific city
  const [establishmentFilter,setEstablishmentFilter]=useState("all"); // "all" or specific establishment name
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
        cityFilter, // New field
        establishmentFilter, // New field
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
      
      {/* Account Overview with Stats */}
      <div className={`rounded-2xl border-2 p-4 ${darkMode ? 'neon-card-purple border-purple-500' : 'border-indigo-400 bg-gradient-to-br from-indigo-50 to-purple-50'}`}>
        <div className="flex items-center gap-3 mb-3">
          <span className="text-3xl">📊</span>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div>
                <h3 className={`font-semibold text-sm mb-1 ${darkMode ? 'text-cyan-300' : 'text-indigo-900'}`}>Account Overview</h3>
                <p className={`text-xs ${darkMode ? 'text-purple-300' : 'text-indigo-700'}`}>Your advertising performance at a glance</p>
              </div>
              <div className={`text-[11px] ${darkMode ? 'text-purple-300' : 'text-indigo-600'}`}>
                Logged in: <span className="font-mono font-semibold">{user?.email||'—'}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="grid md:grid-cols-4 gap-3">
          {/* Billing Status Card */}
          <div className={`rounded-xl border p-3 ${darkMode ? 'bg-slate-800/50 border-cyan-500/30' : 'bg-white border-indigo-200'}`}>
            <div className={`text-xs font-semibold mb-2 flex items-center gap-2 ${darkMode ? 'text-cyan-300' : 'text-indigo-900'}`}>
              <span>💳</span> Billing Status
            </div>
            {advIdRef.current && (window.__advertisers||[]).find(a => a.id === advIdRef.current)?.freeAdvertising ? (
              <>
                <div className="text-[11px] text-green-400 font-semibold mb-1">✓ Free Advertising</div>
                <div className={`text-[11px] ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>No charges for unlocks</div>
                <div className="mt-2">
                  <span className="inline-block text-[11px] px-2 py-1 rounded-full bg-green-500/20 border border-green-500 text-green-400 font-semibold">
                    Card not required
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className={`text-[11px] ${darkMode ? 'text-gray-400' : 'text-gray-600'} mb-1`}>
                  Per unlock: <span className="font-mono font-semibold">{window.GV.fmtMoney(window.__costPerUnlock)}</span>
                </div>
                <div className={`text-[10px] ${darkMode ? 'text-gray-500' : 'text-gray-500'} mb-2`}>
                  (once per device/gnome/cycle)
                </div>
                <div className="mt-2">
                  {card
                    ? <span className="inline-block text-[11px] px-2 py-1 rounded-full bg-green-500/20 border border-green-500 text-green-400 font-semibold">
                        ✓ Card on file
                      </span>
                    : <button className={`rounded px-3 py-1.5 text-xs font-semibold w-full ${
                        darkMode 
                          ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white'
                          : 'bg-black text-white hover:bg-gray-800'
                      }`} onClick={saveCardOnFile}>
                        Add Card
                      </button>}
                </div>
              </>
            )}
          </div>
          
          {/* Total Spend Card */}
          <div className={`rounded-xl border p-3 ${darkMode ? 'bg-slate-800/50 border-pink-500/30' : 'bg-white border-indigo-200'}`}>
            <div className={`text-xs font-semibold mb-2 flex items-center gap-2 ${darkMode ? 'text-pink-300' : 'text-indigo-900'}`}>
              <span>💰</span> Total Spend
            </div>
            <div className={`text-2xl font-black mb-1 ${darkMode ? 'text-cyan-300' : 'text-indigo-900'}`}>
              {window.GV.fmtMoney(spent)}
            </div>
            <div className={`text-[11px] ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {myCharges.length} charge{myCharges.length !== 1 ? 's' : ''}
            </div>
          </div>
          
          {/* Active Coupons Card */}
          <div className={`rounded-xl border p-3 ${darkMode ? 'bg-slate-800/50 border-purple-500/30' : 'bg-white border-indigo-200'}`}>
            <div className={`text-xs font-semibold mb-2 flex items-center gap-2 ${darkMode ? 'text-purple-300' : 'text-indigo-900'}`}>
              <span>🎟️</span> Your Coupons
            </div>
            <div className={`text-2xl font-black mb-1 ${darkMode ? 'text-cyan-300' : 'text-indigo-900'}`}>
              {couponsForMe.filter(c => c.active).length}
            </div>
            <div className={`text-[11px] ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {couponsForMe.length} total ({couponsForMe.filter(c => !c.active).length} paused)
            </div>
          </div>
          
          {/* Performance Card */}
          <div className={`rounded-xl border p-3 ${darkMode ? 'bg-slate-800/50 border-cyan-500/30' : 'bg-white border-indigo-200'}`}>
            <div className={`text-xs font-semibold mb-2 flex items-center gap-2 ${darkMode ? 'text-cyan-300' : 'text-indigo-900'}`}>
              <span>📈</span> Performance
            </div>
            <div className={`text-2xl font-black mb-1 ${darkMode ? 'text-cyan-300' : 'text-indigo-900'}`}>
              {myCharges.length}
            </div>
            <div className={`text-[11px] ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Total unlocks
            </div>
          </div>
        </div>
        
        {msg && <div className={`mt-3 text-xs font-semibold ${darkMode ? 'text-green-400' : 'text-green-700'}`}>{msg}</div>}
      </div>

      {/* Financial Ledger */}
      <div className={`rounded-2xl border-2 p-4 ${darkMode ? 'neon-card-pink border-pink-500' : 'border-green-400 bg-gradient-to-br from-green-50 to-emerald-50'}`}>
        <div className="flex items-center gap-3 mb-3">
          <span className="text-3xl">💳</span>
          <div className="flex-1">
            <h3 className={`font-semibold text-sm mb-1 ${darkMode ? 'text-pink-300' : 'text-green-900'}`}>Transaction Ledger</h3>
            <p className={`text-xs ${darkMode ? 'text-purple-300' : 'text-green-700'}`}>
              Detailed breakdown of all charges by gnome and location
            </p>
          </div>
        </div>
        
        {myCharges.length === 0 ? (
          <div className={`text-center py-8 ${darkMode ? 'text-purple-300' : 'text-gray-600'}`}>
            <div className="text-4xl mb-3">📭</div>
            <div className="text-sm font-semibold mb-1">No charges yet</div>
            <div className="text-xs">Create and activate coupons to start earning unlocks!</div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Group by Gnome */}
            {(() => {
              const chargesByGnome = {};
              myCharges.forEach(charge => {
                if (!charge.gnomeId) return;
                if (!chargesByGnome[charge.gnomeId]) {
                  const gnome = window.GV.GNOMES.find(g => g.id === charge.gnomeId);
                  chargesByGnome[charge.gnomeId] = {
                    gnome,
                    charges: [],
                    total: 0,
                    locations: new Set()
                  };
                }
                chargesByGnome[charge.gnomeId].charges.push(charge);
                chargesByGnome[charge.gnomeId].total += charge.amount || 0;
                
                // Find location for this charge
                const assignment = window.__gnomeAssignments[charge.gnomeId];
                if (assignment) {
                  const partner = (window.__partners || []).find(p => p.id === assignment.partnerId);
                  if (partner) {
                    chargesByGnome[charge.gnomeId].locations.add(partner.establishment || partner.name);
                  }
                }
              });
              
              return Object.values(chargesByGnome).map(({gnome, charges, total, locations}) => (
                <div key={gnome.id} className={`rounded-xl border p-3 ${
                  darkMode 
                    ? 'bg-slate-800/50 border-purple-500/30' 
                    : 'bg-white border-green-200'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <img src={gnome.image} alt={gnome.name} className="w-10 h-10 object-contain float-gnome-sm" />
                      <div>
                        <div className={`text-sm font-semibold ${darkMode ? 'text-cyan-300' : 'text-gray-900'}`}>
                          #{gnome.id} {gnome.name}
                        </div>
                        <div className={`text-[11px] ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          {charges.length} unlock{charges.length !== 1 ? 's' : ''} • {Array.from(locations).join(', ')}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-lg font-black ${darkMode ? 'text-pink-300' : 'text-green-700'}`}>
                        {window.GV.fmtMoney(total)}
                      </div>
                      <div className={`text-[10px] ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                        {window.GV.fmtMoney(total / charges.length)}/unlock
                      </div>
                    </div>
                  </div>
                  
                  {/* Recent Transactions */}
                  <details className="mt-2">
                    <summary className={`text-xs cursor-pointer ${darkMode ? 'text-purple-300 hover:text-cyan-300' : 'text-green-600 hover:text-green-800'}`}>
                      View {charges.length} transaction{charges.length !== 1 ? 's' : ''}
                    </summary>
                    <div className="mt-2 space-y-1">
                      {charges.slice(0, 10).map((charge, idx) => (
                        <div key={idx} className={`text-[11px] flex items-center justify-between py-1 px-2 rounded ${
                          darkMode ? 'bg-slate-900/50' : 'bg-gray-50'
                        }`}>
                          <span className={darkMode ? 'text-gray-400' : 'text-gray-600'}>
                            {new Date(charge.ts).toLocaleDateString()} {new Date(charge.ts).toLocaleTimeString()}
                          </span>
                          <span className={`font-mono font-semibold ${darkMode ? 'text-pink-300' : 'text-green-700'}`}>
                            {window.GV.fmtMoney(charge.amount)}
                          </span>
                        </div>
                      ))}
                      {charges.length > 10 && (
                        <div className={`text-[10px] text-center py-1 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                          ... and {charges.length - 10} more
                        </div>
                      )}
                    </div>
                  </details>
                </div>
              ));
            })()}
          </div>
        )}
      </div>

      {/* Unlocked Gnomes Section */}
      <div className="rounded-2xl border p-3 bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white">
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
      <div className={`rounded-2xl border-2 p-4 ${darkMode ? 'neon-card border-cyan-500' : 'border-blue-400 bg-gradient-to-br from-blue-50 to-indigo-50'}`}>
        <div className="flex items-center gap-3 mb-3">
          <span className="text-3xl">🎟️</span>
          <div className="flex-1">
            <h3 className={`font-semibold text-sm mb-1 ${darkMode ? 'text-cyan-300' : 'text-blue-900'}`}>Create Coupon</h3>
            <p className={`text-xs ${darkMode ? 'text-purple-300' : 'text-blue-700'}`}>
              Design your offer and target specific gnomes, cities, or establishments
            </p>
          </div>
        </div>
        
        <div className="grid md:grid-cols-4 gap-3 text-xs">
          <label className="grid gap-1">
            <span className={`font-semibold ${darkMode ? 'text-cyan-300' : 'text-gray-700'}`}>Title</span>
            <input className={`border rounded px-3 py-2 ${darkMode ? 'bg-slate-800 text-white border-cyan-500' : ''}`} value={title} onChange={e=>setTitle(e.target.value)} placeholder="20% off up to $500"/>
          </label>
          <label className="grid gap-1 md:col-span-2">
            <span className={`font-semibold ${darkMode ? 'text-cyan-300' : 'text-gray-700'}`}>Description</span>
            <input className={`border rounded px-3 py-2 ${darkMode ? 'bg-slate-800 text-white border-cyan-500' : ''}`} value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Good for dine-in only. One-time use."/>
          </label>
          <label className="grid gap-1">
            <span className={`font-semibold ${darkMode ? 'text-cyan-300' : 'text-gray-700'}`}>Target Gnome</span>
            <select className={`border rounded px-3 py-2 ${darkMode ? 'bg-slate-800 text-white border-cyan-500' : ''}`} value={target} onChange={e=>setTarget(e.target.value)}>
              <option value="one">Specific gnome</option>
              <option value="all">All gnomes</option>
              <option value="golden">Golden gnome</option>
            </select>
          </label>
          {target==='one' && <label className="grid gap-1">
            <span className={`font-semibold ${darkMode ? 'text-cyan-300' : 'text-gray-700'}`}>Gnome ID</span>
            <input type="number" className={`border rounded px-3 py-2 ${darkMode ? 'bg-slate-800 text-white border-cyan-500' : ''}`} value={gnomeId} onChange={e=>setGnomeId(e.target.value)}/>
          </label>}
          
          {/* City Filter */}
          <label className="grid gap-1">
            <span className={`font-semibold ${darkMode ? 'text-cyan-300' : 'text-gray-700'}`}>Target City</span>
            <select 
              className={`border rounded px-3 py-2 ${darkMode ? 'bg-slate-800 text-white border-cyan-500' : ''}`}
              value={cityFilter} 
              onChange={e=>setCityFilter(e.target.value)}
            >
              <option value="all">All Cities</option>
              {(() => {
                const cities = new Set();
                (window.__partners || []).forEach(p => {
                  if (p.address) {
                    const parts = p.address.split(',');
                    if (parts.length >= 2) {
                      const city = parts[parts.length - 2].trim();
                      cities.add(city);
                    }
                  }
                });
                return Array.from(cities).sort().map(city => (
                  <option key={city} value={city}>{city}</option>
                ));
              })()}
            </select>
          </label>
          
          {/* Establishment Filter */}
          <label className="grid gap-1">
            <span className={`font-semibold ${darkMode ? 'text-cyan-300' : 'text-gray-700'}`}>Target Establishment</span>
            <select 
              className={`border rounded px-3 py-2 ${darkMode ? 'bg-slate-800 text-white border-cyan-500' : ''}`}
              value={establishmentFilter} 
              onChange={e=>setEstablishmentFilter(e.target.value)}
            >
              <option value="all">All Establishments</option>
              {(() => {
                let partners = window.__partners || [];
                if (cityFilter !== "all") {
                  partners = partners.filter(p => {
                    if (!p.address) return false;
                    const parts = p.address.split(',');
                    if (parts.length >= 2) {
                      const city = parts[parts.length - 2].trim();
                      return city === cityFilter;
                    }
                    return false;
                  });
                }
                
                return partners
                  .filter(p => p.establishment)
                  .sort((a, b) => a.establishment.localeCompare(b.establishment))
                  .map(p => (
                    <option key={p.id} value={p.establishment}>
                      {p.establishment}
                    </option>
                  ));
              })()}
            </select>
          </label>
          
          <label className="grid gap-1">
            <span className={`font-semibold ${darkMode ? 'text-cyan-300' : 'text-gray-700'}`}>Start Date</span>
            <input type="datetime-local" className={`border rounded px-3 py-2 ${darkMode ? 'bg-slate-800 text-white border-cyan-500' : ''}`} value={start} onChange={e=>setStart(e.target.value)}/>
          </label>
          <label className="grid gap-1">
            <span className={`font-semibold ${darkMode ? 'text-cyan-300' : 'text-gray-700'}`}>End Date</span>
            <input type="datetime-local" className={`border rounded px-3 py-2 ${darkMode ? 'bg-slate-800 text-white border-cyan-500' : ''}`} value={end} onChange={e=>setEnd(e.target.value)}/>
          </label>
          <label className="grid gap-1">
            <span className={`font-semibold ${darkMode ? 'text-cyan-300' : 'text-gray-700'}`}>Scan Cap</span>
            <input type="number" className={`border rounded px-3 py-2 ${darkMode ? 'bg-slate-800 text-white border-cyan-500' : ''}`} value={scanCap} onChange={e=>setScanCap(e.target.value)} placeholder="0 = unlimited"/>
          </label>
          <label className="flex items-center gap-2 mt-6">
            <input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)} className="w-4 h-4"/>
            <span className={darkMode ? 'text-purple-300' : ''}>Active on creation</span>
          </label>
        </div>
        
        <div className="mt-4 flex items-center gap-3">
          <button 
            className={`rounded-xl px-6 py-2.5 text-sm font-bold transition-all ${
              darkMode
                ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white shadow-lg shadow-cyan-500/50'
                : 'bg-black text-white hover:bg-gray-800'
            }`}
            onClick={createCoupon} 
            disabled={!card && !(window.__advertisers||[]).find(a => a.id === advIdRef.current)?.freeAdvertising}
          >
            🎟️ Create Coupon
          </button>
          <div className={`text-[11px] ${darkMode ? 'text-purple-300' : 'text-gray-600'}`}>
            💡 Filter by city and/or establishment to target specific locations
          </div>
        </div>
      </div>

      {/* Manage Coupons */}
      <div className={`rounded-2xl border-2 p-4 ${darkMode ? 'neon-card-purple border-purple-500' : 'border-purple-400 bg-gradient-to-br from-purple-50 to-pink-50'}`}>
        <div className="flex items-center gap-3 mb-3">
          <span className="text-3xl">📋</span>
          <div className="flex-1">
            <h3 className={`font-semibold text-sm mb-1 ${darkMode ? 'text-pink-300' : 'text-purple-900'}`}>Manage Coupons</h3>
            <p className={`text-xs ${darkMode ? 'text-purple-300' : 'text-purple-700'}`}>
              Control active coupons and send wallet push notifications
            </p>
          </div>
        </div>

        {couponsForMe.length===0 ? (
          <div className={`text-center py-8 ${darkMode ? 'text-purple-300' : 'text-gray-600'}`}>
            <div className="text-4xl mb-3">🎟️</div>
            <div className="text-sm font-semibold mb-1">No coupons created yet</div>
            <div className="text-xs">Use the form above to create your first coupon!</div>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-3 text-xs">
            {couponsForMe.map(c=>(
              <div key={c.id} className={`rounded-xl border p-3 ${
                darkMode 
                  ? 'bg-slate-800/50 border-purple-500/30' 
                  : 'bg-white border-purple-200'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`font-semibold flex-1 ${darkMode ? 'text-cyan-300' : ''}`}>{c.title}</div>
                  <window.Components.ActiveBadge active={c.active}/>
                </div>
                <div className={`text-[11px] mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{c.desc}</div>
                <div className={`space-y-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  <div className="text-[11px]">🎯 Gnome: <span className="font-mono">{c.target}{c.target==='one'?` #${c.gnomeId}`:''}</span></div>
                  <div className="text-[11px]">🏙️ City: <span className="font-mono">{c.cityFilter || 'All'}</span></div>
                  <div className="text-[11px]">🏢 Establishment: <span className="font-mono">{c.establishmentFilter || 'All'}</span></div>
                  <div className="text-[11px]">📅 Window: <span className="font-mono text-[10px]">{c.startAt?new Date(c.startAt).toLocaleString():'—'} → {c.endAt?new Date(c.endAt).toLocaleString():'—'}</span></div>
                  <div className="text-[11px]">📊 Unlocks: <span className="font-mono font-semibold">{c.unlocks||0}</span>{c.scanCap?` / ${c.scanCap}`:''}</div>
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  <button 
                    className={`rounded px-3 py-1.5 text-xs font-semibold ${
                      c.active 
                        ? (darkMode ? 'bg-orange-600 text-white' : 'bg-orange-500 text-white hover:bg-orange-600')
                        : (darkMode ? 'bg-green-600 text-white' : 'bg-green-500 text-white hover:bg-green-600')
                    }`}
                    onClick={()=>toggleActive(c)}
                  >
                    {c.active?'⏸ Pause':'▶ Activate'}
                  </button>
                  <div className="flex gap-2">
                    <input 
                      className={`border rounded px-2 py-1 flex-1 text-xs ${darkMode ? 'bg-slate-900 text-white border-purple-500' : ''}`}
                      placeholder="Wallet push message" 
                      value={pushText} 
                      onChange={e=>setPushText(e.target.value)}
                    />
                    <button 
                      className={`rounded px-3 py-1 text-xs font-semibold ${
                        darkMode 
                          ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white'
                          : 'bg-black text-white hover:bg-gray-800'
                      }`}
                      onClick={()=>sendWalletPush(c)}
                    >
                      📱 Push
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
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
function Partners({user, darkMode}){
  const partnerRef=useRef(null);
  const addressInputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const [est,setEst]=useState(""); const [addr,setAddr]=useState("");
  const [latLng, setLatLng] = useState(null); // Store actual coordinates
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

  // Initialize Google Places Autocomplete
  useEffect(() => {
    if (!addressInputRef.current || !window.google) return;
    
    const autocomplete = new window.google.maps.places.Autocomplete(addressInputRef.current, {
      types: ['establishment', 'geocode'],
      componentRestrictions: { country: 'us' }
    });
    
    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (!place.geometry || !place.geometry.location) {
        setMsg("No location details available for that address.");
        return;
      }
      
      // Get the formatted address
      const formattedAddress = place.formatted_address || place.name;
      setAddr(formattedAddress);
      
      // Store the exact lat/lng
      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      setLatLng({ lat, lng });
      
      // If establishment name is empty, try to fill it from place name
      if (!est && place.name) {
        setEst(place.name);
      }
    });
    
    autocompleteRef.current = autocomplete;
  }, [est]);

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
    
    // Load partner profile from storage
    const savedProfile = window.GV.loadUserProfile(user.email, 'partner');
    
    let p=(window.__partners||[]).find(x=>x.email===user.email) ||
           (window.__partners||[]).find(x=>x.name===user.name);
    if(!p){
      p={id:'par-'+Math.random().toString(36).slice(2,8),name:user.name||'Partner',email:user.email,establishment:'',address:'',cardOnFile:false,blocked:false};
      window.__partners.push(p);
    }
    
    // Restore saved data if available
    if (savedProfile.establishment) {
      p.establishment = savedProfile.establishment;
      p.address = savedProfile.address;
      p.cardOnFile = savedProfile.cardOnFile;
      if (savedProfile.lat && savedProfile.lng) {
        p.lat = savedProfile.lat;
        p.lng = savedProfile.lng;
      }
    }
    
    partnerRef.current=p; 
    setEst(p.establishment||""); 
    setAddr(p.address||""); 
    setCard(!!p.cardOnFile);
    
    // Load saved lat/lng if available
    if (p.lat && p.lng) {
      setLatLng({ lat: p.lat, lng: p.lng });
    }

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

  // Extract partner's city from address
  const partnerCity = useMemo(() => {
    const p = partnerRef.current;
    if (!p || !p.address) return null;
    const parts = p.address.split(',');
    if (parts.length >= 2) {
      return parts[parts.length - 2].trim();
    }
    return null;
  }, [partnerRef.current?.address]);

  // Check if auction mode is enabled for this partner's city
  const cityAuctionEnabled = useMemo(() => {
    if (!partnerCity) return false;
    return window.__auctionEnabledByCity[partnerCity] || false;
  }, [partnerCity]);

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
      p.establishment=est; 
      p.address=addr;
      
      // Save lat/lng if available from autocomplete
      if (latLng) {
        p.lat = latLng.lat;
        p.lng = latLng.lng;
        setMsg("Profile saved with exact location!");
      } else {
        setMsg("Profile saved (using approximate location).");
      }
      
      // Persist to user profile
      if (user?.email) {
        window.GV.saveUserProfile(user.email, 'partner', {
          establishment: p.establishment,
          address: p.address,
          lat: p.lat,
          lng: p.lng,
          cardOnFile: p.cardOnFile
        });
      }
    }, "Profile Saved!");
  }
  function saveCard(){
    window.GV.performAction(async () => {
      const p=partnerRef.current; if(!p) return;
      p.cardOnFile=true; setCard(true); setMsg("Card on file & authorized.");
      
      // Persist to user profile
      if (user?.email) {
        window.GV.saveUserProfile(user.email, 'partner', {
          cardOnFile: true
        });
      }
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
      
      // Check if admin has claimed this gnome in the same city
      if (assignment.adminClaimed && partnerCity) {
        const adminClaim = window.__adminClaimedGnomes[gnomeId];
        if (adminClaim && adminClaim.city === partnerCity) {
          setMsg(`❌ Gnome #${gnomeId} has been claimed by admin for ${adminClaim.establishment} in ${partnerCity}. This gnome is not available for partners in your city.`);
          return; // Prevent claiming
        }
      }
      
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
    
    // Only count bids from partners in the same city
    for(const r of (window.__partnerBids||[])){ 
      if(r.id===id && r.amt>max){
        const bidderPartner = (window.__partners||[]).find(p=>p.id===r.partnerId);
        if (!bidderPartner || !bidderPartner.address) continue;
        
        // Extract bidder's city
        const bidderParts = bidderPartner.address.split(',');
        const bidderCity = bidderParts.length >= 2 ? bidderParts[bidderParts.length - 2].trim() : null;
        
        // Only count if same city as current partner
        if (bidderCity === partnerCity) {
          max=r.amt; 
          by=r.partnerId;
        }
      }
    }
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
          <div className={`rounded-2xl border-2 p-4 ${
            darkMode 
              ? 'border-red-500 bg-red-950/50'
              : 'border-red-500 bg-red-50'
          }`}>
            <div className="flex items-start gap-3">
              <span className="text-3xl">⚠️</span>
              <div className="flex-1">
                <h3 className={`font-bold mb-2 ${darkMode ? 'text-red-300' : 'text-red-900'}`}>
                  URGENT: Trigger Image Blocked by Admin
                </h3>
                <p className={`mb-3 ${darkMode ? 'text-red-200' : 'text-red-800'}`}>
                  The following gnome trigger images have been deactivated by the administrator. 
                  Participants cannot scan these gnomes until you upload new trigger images!
                </p>
                <div className="space-y-2">
                  {blockedGnomes.map(g => (
                    <div key={g.id} className={`rounded-lg p-3 border ${
                      darkMode 
                        ? 'bg-slate-800/50 border-red-500/30'
                        : 'bg-white border-red-300'
                    }`}>
                      <div className="flex items-center gap-2">
                        <img src={g.image} alt={g.name} className="w-8 h-8 float-gnome-sm" />
                        <span className={`font-semibold ${darkMode ? 'text-red-300' : 'text-red-900'}`}>
                          #{g.id} {g.name} Gnome
                        </span>
                      </div>
                      <p className={`text-sm mt-1 ${darkMode ? 'text-red-200' : 'text-red-700'}`}>
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
      
      {/* Profile - Enhanced */}
      <div className={`rounded-2xl border-2 p-4 ${
        darkMode 
          ? 'neon-card-purple border-purple-500'
          : 'border-indigo-400 bg-gradient-to-br from-indigo-50 to-blue-50'
      }`}>
        <div className="flex items-center gap-3 mb-3">
          <span className="text-3xl">🏢</span>
          <div className="flex-1">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <h3 className={`font-semibold text-sm ${darkMode ? 'text-cyan-300' : 'text-indigo-900'}`}>
                  Partner Profile
                </h3>
                <window.Components.CycleBadge />
                {partnerCity && (
                  <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                    darkMode 
                      ? 'bg-purple-500/30 border border-purple-400 text-purple-300'
                      : 'bg-blue-100 border border-blue-300 text-blue-700'
                  }`}>
                    📍 {partnerCity}
                  </span>
                )}
              </div>
              <div className={`text-[11px] ${darkMode ? 'text-purple-300' : 'text-indigo-600'}`}>
                Logged in: <span className="font-mono font-semibold">{user?.email||'—'}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="grid md:grid-cols-3 gap-3 text-xs">
          <label className="grid gap-1">
            <span className={`font-semibold ${darkMode ? 'text-cyan-300' : 'text-gray-700'}`}>
              Establishment Name
            </span>
            <input 
              className={`border rounded px-3 py-2 ${
                darkMode 
                  ? 'bg-slate-800 text-white border-cyan-500'
                  : ''
              }`}
              value={est} 
              onChange={e=>setEst(e.target.value)}
              placeholder="Your business name"
            />
          </label>
          <label className="grid gap-1 md:col-span-2">
            <span className={`font-semibold ${darkMode ? 'text-cyan-300' : 'text-gray-700'}`}>
              Address (with autocomplete)
            </span>
            <input 
              ref={addressInputRef}
              className={`border rounded px-3 py-2 ${
                darkMode 
                  ? 'bg-slate-800 text-white border-cyan-500'
                  : ''
              }`}
              value={addr} 
              onChange={e=>setAddr(e.target.value)}
              placeholder="Start typing to search for your business..."
            />
            {latLng && (
              <span className={`text-[10px] font-semibold ${
                darkMode ? 'text-green-400' : 'text-green-600'
              }`}>
                ✓ Exact location saved ({latLng.lat.toFixed(6)}, {latLng.lng.toFixed(6)})
              </span>
            )}
          </label>
        </div>
        
        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <button 
            className={`rounded-xl px-6 py-2.5 text-sm font-bold ${
              darkMode 
                ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white shadow-lg shadow-cyan-500/50'
                : 'bg-black text-white hover:bg-gray-800'
            }`}
            onClick={saveProfile}
          >
            💾 Save Profile
          </button>
          {cityAuctionEnabled && (
            card
              ? <span className={`text-[11px] px-3 py-1.5 rounded-full font-semibold ${
                  darkMode 
                    ? 'bg-green-500/20 border border-green-500 text-green-400'
                    : 'bg-green-50 border border-green-500 text-green-700'
                }`}>
                  ✓ Card on file
                </span>
              : <button 
                  className={`rounded-xl px-4 py-2 text-xs font-semibold ${
                    darkMode 
                      ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white'
                      : 'bg-black text-white hover:bg-gray-800'
                  }`}
                  onClick={saveCard}
                >
                  💳 Add Card
                </button>
          )}
          {!cityAuctionEnabled && partnerCity && (
            <span className={`text-[11px] ${darkMode ? 'text-purple-300' : 'text-gray-600'}`}>
              Card not required in selection mode ({partnerCity})
            </span>
          )}
        </div>
        
        {msg && <div className={`mt-3 text-xs font-semibold ${
          darkMode ? 'text-green-400' : 'text-green-700'
        }`}>{msg}</div>}
      </div>

      {/* Bidding or Selection Mode - City-Based */}
      {!partnerCity ? (
        <div className={`rounded-2xl border-2 p-4 ${
          darkMode 
            ? 'border-yellow-500 bg-yellow-950/50'
            : 'border-yellow-400 bg-yellow-50'
        }`}>
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <h3 className={`font-semibold text-sm mb-1 ${
                darkMode ? 'text-yellow-300' : 'text-yellow-900'
              }`}>
                City Required
              </h3>
              <p className={`text-xs ${darkMode ? 'text-yellow-200' : 'text-gray-700'}`}>
                Please enter your establishment address above to see available gnomes for your city.
              </p>
            </div>
          </div>
        </div>
      ) : cityAuctionEnabled ? (
        <div className={`rounded-2xl border-2 p-4 ${
          darkMode 
            ? 'neon-card-pink border-pink-500'
            : 'border-purple-400 bg-gradient-to-br from-purple-50 to-pink-50'
        }`}>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl">🔨</span>
            <div className="flex-1">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className={`font-semibold text-sm ${
                  darkMode ? 'text-pink-300' : 'text-purple-900'
                }`}>
                  Bid for Gnomes — {partnerCity} Auction
                </h3>
                <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                  darkMode 
                    ? 'bg-pink-500/30 border border-pink-400 text-pink-300'
                    : 'bg-purple-100 border border-purple-300 text-purple-700'
                }`}>
                  🔨 Auction Mode
                </span>
              </div>
              <p className={`text-xs mt-1 ${
                darkMode ? 'text-purple-300' : 'text-purple-700'
              }`}>
                You're competing with other establishments in <strong>{partnerCity}</strong>. Highest bid wins each gnome!
              </p>
            </div>
          </div>
          
          <div className="grid md:grid-cols-2 gap-3 text-xs mb-4">
            <label className="grid gap-1">
              <span className={`font-semibold ${darkMode ? 'text-cyan-300' : 'text-gray-700'}`}>
                Select Gnome
              </span>
              <select 
                className={`border rounded px-3 py-2 ${
                  darkMode 
                    ? 'bg-slate-800 text-white border-pink-500'
                    : ''
                }`}
                value={bidGnome} 
                onChange={e=>setBidGnome(e.target.value)}
              >
                {window.GV.GNOMES.map(g=><option key={g.id} value={g.id}>#{g.id} {g.name}</option>)}
              </select>
            </label>
            <label className="grid gap-1">
              <span className={`font-semibold ${darkMode ? 'text-cyan-300' : 'text-gray-700'}`}>
                Your Bid (USD)
              </span>
              <input 
                type="number" 
                className={`border rounded px-3 py-2 ${
                  darkMode 
                    ? 'bg-slate-800 text-white border-pink-500'
                    : ''
                }`}
                value={bid} 
                onChange={e=>setBid(e.target.value)}
              />
            </label>
          </div>
          
          <button 
            className={`rounded-xl px-6 py-2.5 text-sm font-bold ${
              darkMode 
                ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg shadow-pink-500/50'
                : 'bg-black text-white hover:bg-gray-800'
            }`}
            onClick={placeBid} 
            disabled={!card}
          >
            💰 Place Bid
          </button>

          <div className="mt-4 grid md:grid-cols-2 gap-3">
            {window.GV.GNOMES.map(g=>{
              const {max,who}=highestFor(g.id);
              const holder=window.__gnomeAssignments[g.id]?.partnerId;
              const holderRec=(window.__partners||[]).find(p=>p.id===holder);
              return (
                <div key={g.id} className={`rounded-xl border p-3 ${
                  darkMode 
                    ? 'bg-slate-800/50 border-purple-500/30'
                    : 'bg-white border-purple-200'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <img src={g.image} className="w-8 h-8 object-contain float-gnome-sm" alt=""/>
                    <div className={`font-semibold ${darkMode ? 'text-cyan-300' : 'text-gray-900'}`}>
                      #{g.id} {g.name}
                    </div>
                  </div>
                  <div className={`text-[11px] mb-1 ${darkMode ? 'text-pink-300' : 'text-purple-700'}`}>
                    💰 Top bid: <span className="font-mono font-bold">{window.GV.fmtMoney(max)}</span>
                    {who && ` by ${who.establishment||who.name||'Partner'}`}
                  </div>
                  <div className={`text-[11px] ${darkMode ? 'text-purple-300' : 'text-gray-600'}`}>
                    📍 Currently at: <span className="font-mono">{holderRec?.establishment||holderRec?.name||'—'}</span>
                  </div>
                  <div className={`text-[10px] ${darkMode ? 'text-purple-400' : 'text-gray-500'}`}>
                    {holderRec?.address||'—'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className={`rounded-2xl border-2 p-4 ${
          darkMode 
            ? 'neon-card border-cyan-500'
            : 'border-green-400 bg-gradient-to-br from-green-50 to-emerald-50'
        }`}>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl">✨</span>
            <div className="flex-1">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className={`font-semibold text-sm ${
                  darkMode ? 'text-cyan-300' : 'text-green-900'
                }`}>
                  Select Your Gnomes — {partnerCity}
                </h3>
                <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                  darkMode 
                    ? 'bg-green-500/30 border border-green-400 text-green-300'
                    : 'bg-green-100 border border-green-300 text-green-700'
                }`}>
                  ✓ Selection Mode
                </span>
              </div>
              <p className={`text-xs mt-1 ${
                darkMode ? 'text-cyan-200' : 'text-green-700'
              }`}>
                Click a gnome to claim it for <strong>{partnerCity}</strong>. No bidding required. First-come, first-served!
              </p>
            </div>
          </div>
          
          {/* Warning if profile incomplete */}
          {(!est || !addr) && (
            <div className={`mb-4 p-3 rounded-lg border-2 ${
              darkMode 
                ? 'border-yellow-500 bg-yellow-950/50'
                : 'border-yellow-400 bg-yellow-50'
            }`}>
              <div className="flex items-start gap-2">
                <span className="text-xl">⚠️</span>
                <div className="flex-1">
                  <p className={`text-sm font-semibold mb-1 ${
                    darkMode ? 'text-yellow-300' : 'text-yellow-900'
                  }`}>
                    Complete Your Profile First
                  </p>
                  <p className={`text-xs ${darkMode ? 'text-yellow-200' : 'text-yellow-800'}`}>
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
              
              // Check if admin claimed in same city
              const adminClaim = window.__adminClaimedGnomes[g.id];
              const isAdminClaimedInMyCity = adminClaim && partnerCity && adminClaim.city === partnerCity;
              
              const canClick = !isAdminClaimedInMyCity && (isMine || isAvailable);
              
              return (
                <div 
                  key={g.id} 
                  className={`rounded-xl border-2 p-3 text-center transition-all ${
                    darkMode 
                      ? isAdminClaimedInMyCity
                        ? 'border-orange-500/50 bg-orange-950/30 opacity-60 cursor-not-allowed'
                        : isMine 
                          ? 'border-green-500 bg-green-950/50 cursor-pointer' 
                          : isAvailable 
                            ? 'border-cyan-500/50 bg-slate-800/50 hover:border-cyan-400 hover:bg-cyan-950/50 cursor-pointer' 
                            : 'border-red-500/30 bg-red-950/30 opacity-60 cursor-not-allowed'
                      : isAdminClaimedInMyCity
                        ? 'border-orange-500 bg-orange-50 opacity-60 cursor-not-allowed'
                        : isMine 
                          ? 'border-green-500 bg-green-50 cursor-pointer' 
                          : isAvailable 
                            ? 'border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50 cursor-pointer' 
                            : 'border-red-300 bg-red-50 opacity-60 cursor-not-allowed'
                  }`} 
                  onClick={() => {
                    if (canClick) {
                      selectGnome(g.id);
                    }
                  }}
                >
                  <img src={g.image} alt={g.name} className="w-16 h-16 mx-auto mb-2 float-gnome-sm" />
                  <div className={`text-xs font-semibold mb-1 ${
                    darkMode ? 'text-cyan-300' : 'text-gray-900'
                  }`}>
                    #{g.id} {g.name}
                  </div>
                  {isAdminClaimedInMyCity && (
                    <div className={`text-[10px] px-2 py-1 rounded-full ${
                      darkMode ? 'bg-orange-900/50 text-orange-300' : 'bg-orange-200 text-orange-800'
                    }`}>
                      🏆 Admin Claimed<br/>{adminClaim.establishment}
                    </div>
                  )}
                  {isMine && (
                    <div className={`text-xs font-bold mb-1 ${
                      darkMode ? 'text-green-400' : 'text-green-700'
                    }`}>
                      ✓ Your Gnome
                    </div>
                  )}
                  {isAvailable && !isMine && (
                    <div className={`text-xs font-semibold ${
                      darkMode ? 'text-cyan-400' : 'text-blue-600'
                    }`}>
                      Available
                    </div>
                  )}
                  {!isAvailable && !isMine && (
                    <>
                      <div className={`text-xs font-semibold mb-1 ${
                        darkMode ? 'text-red-400' : 'text-red-600'
                      }`}>
                        Unavailable
                      </div>
                      <div className={`text-[10px] ${
                        darkMode ? 'text-purple-400' : 'text-gray-600'
                      }`}>
                        {holderRec?.establishment || holderRec?.name || 'Claimed'}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* my winning gnomes + activate + hint push + submit trigger */}
      <div className={`rounded-2xl border-2 p-4 ${
        darkMode 
          ? 'neon-card-purple border-purple-500'
          : 'border-indigo-400 bg-gradient-to-br from-indigo-50 to-purple-50'
      }`}>
        <div className="flex items-center gap-3 mb-3">
          <span className="text-3xl">🎯</span>
          <div className="flex-1">
            <h3 className={`font-semibold text-sm ${
              darkMode ? 'text-cyan-300' : 'text-indigo-900'
            }`}>
              Gnome Management
            </h3>
            <p className={`text-xs ${
              darkMode ? 'text-purple-300' : 'text-indigo-700'
            }`}>
              Activate gnomes when hidden. Upload trigger images for Admin approval. Push manual hints to participants.
            </p>
          </div>
        </div>
        
        {myWins.length===0 ? (
          <div className={`text-center py-8 ${
            darkMode ? 'text-purple-400' : 'text-gray-500'
          }`}>
            <span className="text-4xl mb-2 block">🔍</span>
            <p className="text-sm font-semibold">No assigned gnomes yet</p>
            <p className="text-xs mt-1">
              {cityAuctionEnabled 
                ? 'Place a winning bid to get started!' 
                : 'Select available gnomes above to begin'}
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-3 text-xs">
            {myWins.map(({gnome,active,prev})=>(
              <div key={gnome.id} className={`rounded-xl border p-3 ${
                darkMode 
                  ? 'bg-slate-800/50 border-purple-500/30'
                  : 'bg-white border-indigo-200'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <img src={gnome.image} className="w-8 h-8 object-contain float-gnome-sm" alt=""/>
                  <div className={`font-semibold ${darkMode ? 'text-cyan-300' : 'text-gray-900'}`}>
                    #{gnome.id} {gnome.name}
                  </div>
                  <span className="ml-auto"><window.Components.ActiveBadge active={active}/></span>
                </div>
                
                <div className={`text-[11px] mb-1 ${darkMode ? 'text-purple-300' : 'text-gray-600'}`}>
                  📍 Previous holder: <span className="font-mono">{prev?.establishment||prev?.name||'—'}</span>
                </div>
                <div className={`text-[10px] mb-3 ${darkMode ? 'text-purple-400' : 'text-gray-500'}`}>
                  Pickup: <span className="font-mono">{prev?.address||'—'}</span>
                </div>
                
                <div className="space-y-2">
                  <button 
                    className={`w-full rounded-lg px-3 py-2 text-xs font-semibold ${
                      active 
                        ? darkMode 
                          ? 'bg-red-500/20 border border-red-500 text-red-400'
                          : 'bg-red-50 border border-red-500 text-red-700'
                        : darkMode 
                          ? 'bg-green-500/20 border border-green-500 text-green-400'
                          : 'bg-green-50 border border-green-500 text-green-700'
                    }`}
                    onClick={()=>toggleActivate(gnome.id)}
                  >
                    {active ? '⏸️ Deactivate' : '▶️ Activate'}
                  </button>
                  
                  <div className="flex gap-2">
                    <input 
                      className={`border rounded px-2 py-1.5 flex-1 text-xs ${
                        darkMode 
                          ? 'bg-slate-800 text-white border-cyan-500'
                          : ''
                      }`}
                      placeholder="Manual clue to push" 
                      value={hintText} 
                      onChange={e=>setHintText(e.target.value)}
                    />
                    <input 
                      type="number" 
                      className={`border rounded px-2 py-1.5 w-16 text-xs ${
                        darkMode 
                          ? 'bg-slate-800 text-white border-cyan-500'
                          : ''
                      }`}
                      placeholder="min"
                      value={hintMinutes} 
                      onChange={e=>setHintMinutes(e.target.value)}
                    />
                  </div>
                  
                  <button 
                    className={`w-full rounded-lg px-3 py-2 text-xs font-semibold ${
                      darkMode 
                        ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white'
                        : 'bg-black text-white hover:bg-gray-800'
                    }`}
                    onClick={()=>pushHint(gnome.id)}
                  >
                    📣 Push Hint
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {myWins.length > 0 && (
          <div className="mt-4 pt-4 border-t border-purple-500/30">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">📸</span>
              <div className={`font-semibold text-xs ${darkMode ? 'text-cyan-300' : 'text-indigo-900'}`}>
                Submit Trigger Images to Admin
              </div>
            </div>
            <div className="space-y-3">
              {myWins.map(({gnome}) => {
                const existingTrigger = window.__triggerImages[gnome.id];
                const isBlocked = existingTrigger?.blocked;
                
                return (
                  <div key={gnome.id} className={`rounded-xl border p-3 text-xs ${
                    isBlocked
                      ? darkMode 
                        ? 'bg-red-950/50 border-red-500'
                        : 'bg-red-50 border-red-500'
                      : darkMode 
                        ? 'bg-slate-800/50 border-purple-500/30'
                        : 'bg-white border-indigo-200'
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      <img src={gnome.image} className="w-6 h-6 object-contain float-gnome-sm" alt=""/>
                      <div className={`font-semibold ${darkMode ? 'text-cyan-300' : 'text-gray-900'}`}>
                        #{gnome.id} {gnome.name}
                      </div>
                      {isBlocked && (
                        <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          darkMode 
                            ? 'bg-red-500/30 border border-red-500 text-red-400'
                            : 'bg-red-100 border border-red-500 text-red-700'
                        }`}>
                          ⚠️ BLOCKED
                        </span>
                      )}
                    </div>
                    {isBlocked && (
                      <p className={`text-[11px] mb-2 ${darkMode ? 'text-red-300' : 'text-red-700'}`}>
                        Current trigger image was blocked by Admin. Upload a new image immediately!
                      </p>
                    )}
                    <div className="flex gap-2 items-end">
                      <input 
                        type="file" 
                        accept="image/*" 
                        className={`border rounded px-2 py-1.5 flex-1 text-xs ${
                          darkMode 
                            ? 'bg-slate-800 text-white border-cyan-500'
                            : ''
                        }`}
                        onChange={e => setUploadFiles({...uploadFiles, [gnome.id]: e.target.files?.[0]||null})}
                      />
                      <button 
                        className={`rounded-lg px-4 py-1.5 font-semibold text-xs ${
                          darkMode 
                            ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white'
                            : 'bg-black text-white hover:bg-gray-800'
                        }`}
                        onClick={() => submitTriggerImage(gnome.id)}
                        disabled={!uploadFiles[gnome.id]}
                      >
                        📤 Submit
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
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
function Admin({user, darkMode, setDarkMode}) {
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
  const [, forceUpdate] = useState({});
  
  // Gnome claiming states
  const [claimingGnome, setClaimingGnome] = useState(null);
  const [claimEstablishment, setClaimEstablishment] = useState("");
  const [claimAddress, setClaimAddress] = useState("");
  const [claimCity, setClaimCity] = useState("");
  const [claimImage, setClaimImage] = useState(null);
  const [claimImagePreview, setClaimImagePreview] = useState("");

  // Get all unique cities from partner addresses
  const allCities = useMemo(() => {
    const cities = new Set();
    (window.__partners || []).forEach(p => {
      if (p.address) {
        const parts = p.address.split(',');
        if (parts.length >= 2) {
          const city = parts[parts.length - 2].trim();
          cities.add(city);
        }
      }
    });
    return Array.from(cities).sort();
  }, [window.__partners?.length]);

  function setCostPerUnlock(){
    window.__costPerUnlock = Number(cost)||0;
    setMsg("Updated advertiser cost-per-unlock.");
  }
  
  function toggleCityAuctionMode(city){
    const wasEnabled = window.__auctionEnabledByCity[city] || false;
    const newState = !wasEnabled;
    
    window.GV.performAction(async () => {
      window.__auctionEnabledByCity[city] = newState;
      setMsg(`Auction mode ${newState ? 'ENABLED' : 'DISABLED'} for ${city}. Partners in ${city} ${newState ? 'must bid' : 'can select gnomes directly'}.`);
      forceUpdate({});
    }, newState ? `Auction Enabled for ${city}!` : `Selection Mode for ${city}!`);
  }
  
  function toggleAllCitiesAuctionMode(enable){
    window.GV.performAction(async () => {
      allCities.forEach(city => {
        window.__auctionEnabledByCity[city] = enable;
      });
      setMsg(`Auction mode ${enable ? 'ENABLED' : 'DISABLED'} for all cities.`);
      forceUpdate({});
    }, enable ? "Auction Enabled for All Cities!" : "Selection Mode for All Cities!");
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
  
  function openClaimModal(gnomeId) {
    setClaimingGnome(gnomeId);
    setClaimEstablishment("");
    setClaimAddress("");
    setClaimCity("");
    setClaimImage(null);
    setClaimImagePreview("");
  }
  
  function closeClaimModal() {
    setClaimingGnome(null);
    setClaimEstablishment("");
    setClaimAddress("");
    setClaimCity("");
    setClaimImage(null);
    setClaimImagePreview("");
  }
  
  function handleClaimImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setClaimImage(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setClaimImagePreview(ev.target.result);
    };
    reader.readAsDataURL(file);
  }
  
  function submitGnomeClaim() {
    if (!claimingGnome) return;
    if (!claimEstablishment || !claimAddress || !claimCity || !claimImage) {
      alert("Please fill in all fields and upload an image.");
      return;
    }
    
    window.GV.performAction(async () => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const imageDataUrl = e.target.result;
          
          // Store the claim
          window.__adminClaimedGnomes[claimingGnome] = {
            establishment: claimEstablishment,
            address: claimAddress,
            city: claimCity,
            imageDataUrl: imageDataUrl,
            ts: Date.now()
          };
          
          // Also update the assignment to mark as admin-claimed
          if (!window.__gnomeAssignments[claimingGnome]) {
            window.__gnomeAssignments[claimingGnome] = {};
          }
          window.__gnomeAssignments[claimingGnome].adminClaimed = true;
          window.__gnomeAssignments[claimingGnome].claimedCity = claimCity;
          
          setMsg(`Gnome #${claimingGnome} claimed for ${claimEstablishment} in ${claimCity}. Partners in ${claimCity} can no longer claim this gnome.`);
          closeClaimModal();
          resolve();
        };
        reader.readAsDataURL(claimImage);
      });
    }, "Gnome Claimed Successfully!");
  }
  
  function releaseGnomeClaim(gnomeId) {
    if (!confirm(`Release gnome #${gnomeId} and make it available to partners again?`)) return;
    
    window.GV.performAction(async () => {
      const claim = window.__adminClaimedGnomes[gnomeId];
      delete window.__adminClaimedGnomes[gnomeId];
      
      if (window.__gnomeAssignments[gnomeId]) {
        delete window.__gnomeAssignments[gnomeId].adminClaimed;
        delete window.__gnomeAssignments[gnomeId].claimedCity;
      }
      
      setMsg(`Gnome #${gnomeId} released from ${claim?.establishment || 'admin claim'}. Partners can now claim it.`);
      forceUpdate({});
    }, "Gnome Released!");
  }

  const coupons=window.__coupons||[];
  const advertisers=window.__advertisers||[];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border p-3 bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">Admin Controls</h3>
            <window.Components.CycleBadge />
          </div>
          <div className="text-[11px] text-gray-600">Logged in: <span className="font-mono">{user?.email||'—'}</span></div>
        </div>
        <div className="text-xs grid md:grid-cols-2 gap-3 mt-3">
          <label className="grid gap-1">Cost per unlock (advertiser)
            <input type="number" className="border rounded px-2 py-1" value={cost} onChange={e=>setCost(e.target.value)}/>
          </label>
          <div className="flex items-end">
            <button className="rounded bg-black text-white px-3 py-1.5 text-sm" onClick={setCostPerUnlock}>Update Cost</button>
          </div>
        </div>
        
        {msg && <div className="mt-2 text-xs text-green-700">{msg}</div>}
      </div>
      
      {/* Dark Mode Toggle */}
      <div className="rounded-2xl border-2 border-indigo-400 bg-gradient-to-r from-indigo-50 to-purple-50 p-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{darkMode ? '🌙' : '☀️'}</span>
          <div className="flex-1">
            <h3 className="font-semibold text-sm text-indigo-900 mb-1">App Theme</h3>
            <p className="text-xs text-indigo-700">
              Toggle between light and dark mode to see which theme makes the app pop more with color and depth.
            </p>
          </div>
          <button
            className={`rounded-xl px-6 py-3 text-sm font-bold transition-all ${
              darkMode 
                ? 'bg-gradient-to-r from-gray-700 to-gray-900 text-white hover:from-gray-800 hover:to-black' 
                : 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white hover:from-yellow-500 hover:to-orange-600'
            }`}
            onClick={() => setDarkMode(!darkMode)}
          >
            {darkMode ? '🌙 Dark Mode ON' : '☀️ Light Mode ON'}
          </button>
        </div>
      </div>
      
      {/* Admin Gnome Claiming Section */}
      <div className={`rounded-2xl border-2 p-4 ${
        darkMode 
          ? 'border-orange-500 bg-gradient-to-r from-orange-900/30 to-yellow-900/30' 
          : 'border-orange-400 bg-gradient-to-r from-orange-50 to-yellow-50'
      }`}>
        <div className="flex items-center gap-3 mb-3">
          <span className="text-3xl">🏆</span>
          <div className="flex-1">
            <h3 className={`font-semibold text-sm mb-1 ${darkMode ? 'text-orange-300' : 'text-orange-900'}`}>
              Claim Gnomes for Establishments
            </h3>
            <p className={`text-xs ${darkMode ? 'text-orange-400' : 'text-orange-700'}`}>
              As admin, you can claim gnomes on behalf of establishments. Once claimed, partners in that city cannot claim these gnomes.
            </p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {window.GV.GNOMES.map(gnome => {
            const claim = window.__adminClaimedGnomes[gnome.id];
            const isClaimed = !!claim;
            
            return (
              <div key={gnome.id} className={`relative rounded-lg border-2 p-3 ${
                isClaimed 
                  ? darkMode
                    ? 'bg-green-900/40 border-green-500'
                    : 'bg-green-100 border-green-500'
                  : darkMode
                    ? 'bg-gray-800 border-orange-500 hover:border-orange-400'
                    : 'bg-white border-orange-300 hover:border-orange-500'
              }`}>
                <img 
                  src={gnome.image} 
                  alt={gnome.name}
                  className="w-full h-24 object-contain mb-2"
                />
                <div className="text-center">
                  <div className={`text-xs font-bold mb-1 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    #{gnome.id} {gnome.name}
                  </div>
                  
                  {isClaimed ? (
                    <div className="space-y-2">
                      <div className={`text-[10px] font-semibold ${darkMode ? 'text-green-400' : 'text-green-800'}`}>
                        ✓ CLAIMED
                      </div>
                      <div className={`text-[10px] ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        {claim.establishment}
                      </div>
                      <div className={`text-[9px] ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        📍 {claim.city}
                      </div>
                      {claim.imageDataUrl && (
                        <img 
                          src={claim.imageDataUrl} 
                          alt="Location"
                          className="w-full h-16 object-cover rounded border"
                        />
                      )}
                      <button
                        className="w-full rounded-lg bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-3 py-2 text-xs font-bold shadow-md hover:shadow-lg transition-all"
                        onClick={() => releaseGnomeClaim(gnome.id)}
                      >
                        🔓 Release
                      </button>
                    </div>
                  ) : (
                    <button
                      className="w-full rounded-lg font-bold shadow-lg transition-all transform hover:scale-105"
                      style={{
                        background: 'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)',
                        color: 'white',
                        padding: '12px 16px',
                        fontSize: '14px',
                        border: '2px solid #ff4500',
                        cursor: 'pointer'
                      }}
                      onClick={() => openClaimModal(gnome.id)}
                    >
                      🏆 CLAIM THIS GNOME
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Claim Modal */}
      {claimingGnome && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto ${
            darkMode ? 'bg-gray-900' : 'bg-white'
          }`}>
            <div className="sticky top-0 bg-gradient-to-r from-orange-600 to-red-600 text-white px-6 py-4 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">
                  Claim Gnome #{claimingGnome}
                </h3>
                <button 
                  onClick={closeClaimModal}
                  className="text-white hover:text-gray-200 text-2xl font-bold"
                >
                  ×
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="text-center mb-4">
                <img 
                  src={window.GV.GNOMES.find(g => g.id === claimingGnome)?.image}
                  alt="Gnome"
                  className="w-32 h-32 object-contain mx-auto"
                />
                <div className={`text-xl font-bold mt-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  {window.GV.GNOMES.find(g => g.id === claimingGnome)?.name}
                </div>
              </div>
              
              <div>
                <label className={`block text-sm font-semibold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Establishment Name *
                </label>
                <input
                  type="text"
                  className={`w-full border-2 rounded-lg px-4 py-2 focus:border-orange-500 focus:outline-none ${
                    darkMode 
                      ? 'bg-gray-800 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  placeholder="e.g., Beach Bar & Grill"
                  value={claimEstablishment}
                  onChange={(e) => setClaimEstablishment(e.target.value)}
                />
              </div>
              
              <div>
                <label className={`block text-sm font-semibold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  City *
                </label>
                <input
                  type="text"
                  className={`w-full border-2 rounded-lg px-4 py-2 focus:border-orange-500 focus:outline-none ${
                    darkMode 
                      ? 'bg-gray-800 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  placeholder="e.g., Clearwater"
                  value={claimCity}
                  onChange={(e) => setClaimCity(e.target.value)}
                />
                <div className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Partners in this city won't be able to claim this gnome
                </div>
              </div>
              
              <div>
                <label className={`block text-sm font-semibold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Full Address *
                </label>
                <input
                  type="text"
                  className={`w-full border-2 rounded-lg px-4 py-2 focus:border-orange-500 focus:outline-none ${
                    darkMode 
                      ? 'bg-gray-800 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  placeholder="e.g., 123 Beach Ave, Clearwater, FL 33767"
                  value={claimAddress}
                  onChange={(e) => setClaimAddress(e.target.value)}
                />
              </div>
              
              <div>
                <label className={`block text-sm font-semibold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Upload Image *
                </label>
                <input
                  type="file"
                  accept="image/*"
                  className={`w-full border-2 rounded-lg px-4 py-2 focus:border-orange-500 focus:outline-none ${
                    darkMode 
                      ? 'bg-gray-800 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  onChange={handleClaimImageUpload}
                />
                {claimImagePreview && (
                  <div className="mt-3">
                    <img 
                      src={claimImagePreview}
                      alt="Preview"
                      className="w-full h-48 object-cover rounded-lg border-2 border-gray-300"
                    />
                  </div>
                )}
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  className="flex-1 rounded-lg bg-gray-300 hover:bg-gray-400 text-gray-800 px-6 py-3 font-semibold"
                  onClick={closeClaimModal}
                >
                  Cancel
                </button>
                <button
                  className="flex-1 rounded-lg bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white px-6 py-3 font-semibold"
                  onClick={submitGnomeClaim}
                >
                  Claim Gnome
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* City-Based Auction Mode Controls */}
      <div className="rounded-2xl border-2 border-blue-400 bg-blue-50 p-4">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-3xl">🏙️</span>
          <div className="flex-1">
            <h3 className="font-semibold text-sm text-blue-900 mb-1">City Auction Mode Controls</h3>
            <p className="text-xs text-blue-700">
              Toggle auction mode per city. When enabled, partners must bid for gnomes. When disabled, partners can select gnomes directly.
            </p>
          </div>
        </div>
        
        {/* Global toggle buttons */}
        <div className="mb-4 flex gap-2">
          <button
            className="rounded bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 text-sm font-semibold"
            onClick={() => toggleAllCitiesAuctionMode(true)}
          >
            🔨 Enable Auction for All Cities
          </button>
          <button
            className="rounded bg-green-600 hover:bg-green-700 text-white px-4 py-2 text-sm font-semibold"
            onClick={() => toggleAllCitiesAuctionMode(false)}
          >
            ✓ Enable Selection for All Cities
          </button>
        </div>
        
        {/* Per-city controls */}
        {allCities.length === 0 ? (
          <div className="text-xs text-gray-600 p-3 bg-white rounded-lg border">
            No cities yet. Cities will appear here once partners register with addresses.
          </div>
        ) : (
          <div className="space-y-2">
            {allCities.map(city => {
              const isAuctionEnabled = window.__auctionEnabledByCity[city] || false;
              const partnersInCity = (window.__partners || []).filter(p => {
                if (!p.address) return false;
                const parts = p.address.split(',');
                const partnerCity = parts.length >= 2 ? parts[parts.length - 2].trim() : null;
                return partnerCity === city;
              });
              
              return (
                <div key={city} className="bg-white rounded-lg border border-blue-300 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-semibold text-sm text-gray-900 mb-1">
                        📍 {city}
                      </div>
                      <div className="text-xs text-gray-600">
                        {partnersInCity.length} partner{partnersInCity.length !== 1 ? 's' : ''} registered
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs px-3 py-1 rounded-full font-semibold ${
                        isAuctionEnabled 
                          ? 'bg-purple-100 border border-purple-400 text-purple-800' 
                          : 'bg-green-100 border border-green-400 text-green-800'
                      }`}>
                        {isAuctionEnabled ? '🔨 Auction Mode' : '✓ Selection Mode'}
                      </span>
                      <button
                        className={`rounded px-4 py-1.5 text-sm font-semibold transition-colors ${
                          isAuctionEnabled
                            ? 'bg-green-600 hover:bg-green-700 text-white'
                            : 'bg-purple-600 hover:bg-purple-700 text-white'
                        }`}
                        onClick={() => toggleCityAuctionMode(city)}
                      >
                        Switch to {isAuctionEnabled ? 'Selection' : 'Auction'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      {/* Reset Assignments Button */}
      <div className="rounded-2xl border p-3 bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white">
        <div className="flex items-center justify-between">
          <div className="flex-1 mr-3">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Reset Gnome Assignments</h3>
            <p className="text-xs text-gray-600">
              Clear all current gnome assignments to let partners select/bid freely. Useful when changing modes or starting fresh.
            </p>
          </div>
          <button 
            className="rounded bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 text-sm font-semibold whitespace-nowrap"
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

      {/* Cycle Management */}
      <div className="rounded-2xl border-2 border-purple-400 bg-gradient-to-br from-purple-50 to-pink-50 p-4">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-3xl">🔄</span>
          <div className="flex-1">
            <h3 className="font-semibold text-sm text-purple-900 mb-1">Close Bids & Start New Cycle</h3>
            <p className="text-xs text-purple-700">
              When you finalize winners for the new month, click this to start a new hunt cycle.
              This resets player "Gnome Bonus!" spins and ties new unlocks to the fresh assignments.
            </p>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border border-purple-300 p-3">
          <div className={`text-xs mb-2 ${
            darkMode ? 'text-gray-300' : 'text-gray-600'
          }`}>
            Current Cycle: <span className={`font-mono font-semibold ${
              darkMode ? 'text-purple-300' : 'text-purple-900'
            }`}>{window.GV.getCycleId()}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <input 
              id="cycleLabel" 
              className="flex-1 rounded border border-purple-300 px-2 py-1.5 text-sm" 
              placeholder="Optional label e.g. 2025-12"
            />
            <button
              className="rounded bg-purple-600 hover:bg-purple-700 text-white px-4 py-1.5 text-sm font-semibold whitespace-nowrap"
              onClick={()=>{
                if (confirm('Are you sure you want to START A NEW CYCLE? This will reset all participant bonus spins.')) {
                  window.GV.performAction(async () => {
                    const label = document.getElementById('cycleLabel')?.value || '';
                    const cid = window.GV.bumpCycle(label);
                    setMsg(`New cycle started: ${cid}`);
                    document.getElementById('cycleLabel').value = '';
                  }, 'New Cycle Started!');
                }
              }}
            >
              🚀 Start New Cycle
            </button>
          </div>
          
          <div className="text-[11px] text-gray-500 mt-2">
            💡 Tip: Use this after assigning new winners or at the start of each month to give all participants a fresh bonus spin opportunity.
          </div>
        </div>
      </div>

      {/* Push Bonus Spins */}
      <div className="rounded-2xl border-2 border-emerald-400 bg-gradient-to-br from-emerald-50 to-teal-50 p-4">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-3xl">🎰</span>
          <div className="flex-1">
            <h3 className="font-semibold text-sm text-emerald-900 mb-1">Push Free Bonus Spins Campaign</h3>
            <p className="text-xs text-emerald-700">
              Grant free slot machine spins to ALL participants with a time limit. They'll see a banner, countdown timer, and animated button!
            </p>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border border-emerald-300 p-3">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Number of Spins</label>
              <input 
                type="number"
                min="1"
                max="100"
                defaultValue="3"
                id="bonusSpinCount" 
                className="w-full rounded border border-emerald-300 px-3 py-1.5 text-sm text-center font-bold" 
                placeholder="3"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Duration (hours)</label>
              <input 
                type="number"
                min="1"
                max="168"
                defaultValue="24"
                id="bonusSpinDuration" 
                className="w-full rounded border border-emerald-300 px-3 py-1.5 text-sm text-center font-bold" 
                placeholder="24"
              />
            </div>
          </div>
          
          <button
            className="w-full rounded bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-sm font-semibold"
            onClick={()=>{
              const spinCount = Number(document.getElementById('bonusSpinCount')?.value) || 3;
              const durationHours = Number(document.getElementById('bonusSpinDuration')?.value) || 24;
              if (confirm(`Push ${spinCount} FREE bonus spin${spinCount > 1 ? 's' : ''} to ALL participants?\n\nCampaign Duration: ${durationHours} hour${durationHours > 1 ? 's' : ''}`)) {
                window.GV.performAction(async () => {
                  window.GV.pushBonusSpinsCampaign(spinCount, durationHours);
                  setMsg(`Pushed ${spinCount} bonus spin${spinCount > 1 ? 's' : ''} campaign for ${durationHours} hours!`);
                }, `${spinCount} Bonus Spins Campaign Started!`);
              }
            }}
          >
            🎁 Launch Bonus Spins Campaign
          </button>
          
          <div className="text-[11px] text-gray-500 mt-2">
            💡 Participants will see a banner with countdown timer and animated "Gnome Bonus!" button during the campaign
          </div>
        </div>
      </div>
      
      {/* Financial Ledger */}
      <div className="rounded-2xl border-2 border-green-400 bg-gradient-to-br from-green-50 to-emerald-50 p-4">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-3xl">💰</span>
          <div className="flex-1">
            <h3 className="font-semibold text-sm text-green-900 mb-1">Financial Ledger</h3>
            <p className="text-xs text-green-700">Revenue breakdown with hierarchical drill-down by city → establishment/advertiser</p>
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
          
          // Group charges by city
          const chargesByCity = {};
          
          // Process partner charges
          partnerCharges.forEach(charge => {
            const partner = (window.__partners || []).find(p => p.id === charge.partnerId);
            if (!partner || !partner.address) return;
            
            const parts = partner.address.split(',');
            const city = parts.length >= 2 ? parts[parts.length - 2].trim() : 'Unknown City';
            
            if (!chargesByCity[city]) {
              chargesByCity[city] = {
                total: 0,
                partnerTotal: 0,
                advertiserTotal: 0,
                partners: {},
                advertisers: {}
              };
            }
            
            chargesByCity[city].total += charge.amount || 0;
            chargesByCity[city].partnerTotal += charge.amount || 0;
            
            if (!chargesByCity[city].partners[partner.id]) {
              chargesByCity[city].partners[partner.id] = {
                partner,
                charges: [],
                total: 0
              };
            }
            
            chargesByCity[city].partners[partner.id].charges.push(charge);
            chargesByCity[city].partners[partner.id].total += charge.amount || 0;
          });
          
          // Process advertiser charges (link to partner gnome location)
          advertiserCharges.forEach(charge => {
            const advertiser = (window.__advertisers || []).find(a => a.id === charge.advertiserId);
            if (!advertiser) return;
            
            // Find the gnome and its partner to determine city
            let city = 'Unknown City';
            if (charge.gnomeId) {
              const assignment = window.__gnomeAssignments[charge.gnomeId];
              if (assignment) {
                const partner = (window.__partners || []).find(p => p.id === assignment.partnerId);
                if (partner && partner.address) {
                  const parts = partner.address.split(',');
                  city = parts.length >= 2 ? parts[parts.length - 2].trim() : 'Unknown City';
                }
              }
            }
            
            if (!chargesByCity[city]) {
              chargesByCity[city] = {
                total: 0,
                partnerTotal: 0,
                advertiserTotal: 0,
                partners: {},
                advertisers: {}
              };
            }
            
            chargesByCity[city].total += charge.amount || 0;
            chargesByCity[city].advertiserTotal += charge.amount || 0;
            
            if (!chargesByCity[city].advertisers[advertiser.id]) {
              chargesByCity[city].advertisers[advertiser.id] = {
                advertiser,
                charges: [],
                total: 0
              };
            }
            
            chargesByCity[city].advertisers[advertiser.id].charges.push(charge);
            chargesByCity[city].advertisers[advertiser.id].total += charge.amount || 0;
          });
          
          const cities = Object.keys(chargesByCity).sort();
          
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
              
              {/* City-based Hierarchical Breakdown */}
              <div>
                <h4 className="text-xs font-bold text-green-900 mb-2 flex items-center gap-2">
                  <span>�️</span> Revenue by City (Drill-down)
                </h4>
                <div className="space-y-2">
                  {cities.map(city => {
                    const cityData = chargesByCity[city];
                    
                    return (
                      <details key={city} className="bg-white rounded-lg border-2 border-green-300 p-3">
                        <summary className="cursor-pointer font-semibold text-sm text-green-900 hover:text-green-700 flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <span>📍</span> {city}
                          </span>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-600">
                              Partners: {window.GV.fmtMoney(cityData.partnerTotal)} | 
                              Advertisers: {window.GV.fmtMoney(cityData.advertiserTotal)}
                            </span>
                            <span className="text-sm font-black text-green-900">{window.GV.fmtMoney(cityData.total)}</span>
                          </div>
                        </summary>
                        
                        <div className="mt-3 space-y-3">
                          {/* Partners in this city */}
                          {Object.keys(cityData.partners).length > 0 && (
                            <div>
                              <h5 className="text-xs font-bold text-blue-900 mb-2 flex items-center gap-2">
                                <span>🏢</span> Partners
                              </h5>
                              <div className="space-y-2">
                                {Object.values(cityData.partners).map(({partner, charges, total}) => (
                                  <details key={partner.id} className="bg-blue-50 rounded border border-blue-200 p-2">
                                    <summary className="cursor-pointer text-xs font-semibold text-gray-900 hover:text-blue-700 flex items-center justify-between">
                                      <span>{partner.establishment || partner.name}</span>
                                      <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-gray-500">{charges.length} charges</span>
                                        <span className="text-xs font-bold text-blue-900">{window.GV.fmtMoney(total)}</span>
                                      </div>
                                    </summary>
                                    <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                                      {charges.map((c, idx) => (
                                        <div key={idx} className="flex justify-between text-[10px] border-t border-blue-100 pt-1">
                                          <span className="text-gray-600">{c.note || 'Charge'}</span>
                                          <span className="font-mono font-semibold">{window.GV.fmtMoney(c.amount)}</span>
                                          <span className="text-gray-400">{new Date(c.ts).toLocaleDateString()}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </details>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Advertisers in this city */}
                          {Object.keys(cityData.advertisers).length > 0 && (
                            <div>
                              <h5 className="text-xs font-bold text-purple-900 mb-2 flex items-center gap-2">
                                <span>📢</span> Advertisers
                              </h5>
                              <div className="space-y-2">
                                {Object.values(cityData.advertisers).map(({advertiser, charges, total}) => (
                                  <details key={advertiser.id} className="bg-purple-50 rounded border border-purple-200 p-2">
                                    <summary className="cursor-pointer text-xs font-semibold text-gray-900 hover:text-purple-700 flex items-center justify-between">
                                      <span className="flex items-center gap-2">
                                        {advertiser.name}
                                        {advertiser.freeAdvertising && (
                                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-300">
                                            FREE
                                          </span>
                                        )}
                                      </span>
                                      <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-gray-500">{charges.length} charges</span>
                                        <span className="text-xs font-bold text-purple-900">{window.GV.fmtMoney(total)}</span>
                                      </div>
                                    </summary>
                                    <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                                      {charges.map((c, idx) => (
                                        <div key={idx} className="flex justify-between text-[10px] border-t border-purple-100 pt-1">
                                          <span className="text-gray-600">{c.note || 'Unlock'}</span>
                                          <span className="font-mono font-semibold">{window.GV.fmtMoney(c.amount)}</span>
                                          <span className="text-gray-400">{new Date(c.ts).toLocaleDateString()}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </details>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </details>
                    );
                  })}
                </div>
              </div>
            </>
          );
        })()}
      </div>
      
      {/* Advertiser Management */}
      <div className="rounded-2xl border p-3 bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white">
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

      <div className="rounded-2xl border p-3 bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white">
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

      <div className="rounded-2xl border p-3 bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white">
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
      <div className="rounded-2xl border p-3 bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white">
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

      <div className="rounded-2xl border p-3 bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white">
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

      <div className="rounded-2xl border p-3 bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white">
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
function Tabs({tab,setTab,role,user,participantRef}) {
  const [remainingBonusSpins, setRemainingBonusSpins] = useState(0);
  
  // Load bonus spins count for participant view
  useEffect(() => {
    if (role === 'participant' || (role === 'admin' && tab === 'participant')) {
      const userEmail = user?.email;
      const storageKey = userEmail || window.GV.DEVICE_ID;
      const BONUS_SPINS_KEY = `bonus_spins_${storageKey}`;
      
      const loadBonusSpins = () => {
        try {
          const bonusData = JSON.parse(localStorage.getItem(BONUS_SPINS_KEY));
          if (bonusData && bonusData.remaining) {
            setRemainingBonusSpins(bonusData.remaining);
          } else {
            setRemainingBonusSpins(0);
          }
        } catch {
          setRemainingBonusSpins(0);
        }
      };
      
      loadBonusSpins();
      
      // Listen for bonus push events
      const handleStorage = (e) => {
        if (e.key === '__bonus_push' || e.key === BONUS_SPINS_KEY) {
          loadBonusSpins();
        }
      };
      window.addEventListener('storage', handleStorage);
      
      // Also poll for changes (in case storage event doesn't fire)
      const interval = setInterval(loadBonusSpins, 1000);
      
      return () => {
        clearInterval(interval);
        window.removeEventListener('storage', handleStorage);
      };
    }
  }, [role, tab, user]);
  
  const onBonusClick = () => {
    if (remainingBonusSpins > 0 && participantRef?.current?.openBonusModal) {
      participantRef.current.openBonusModal();
    }
  };
  
  const btn=(k,label)=>(
    <button onClick={()=>setTab(k)} className={`px-3 py-1.5 rounded-full border text-sm ${tab===k?'bg-black text-white':'bg-white hover:bg-gray-50'}`}>{label}</button>
  );
  
  const showBonusButton = (role === 'participant' || (role === 'admin' && tab === 'participant'));
  
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {showBonusButton && (
        <button
          onClick={onBonusClick}
          className={`px-3 py-1.5 rounded-full border text-sm ${remainingBonusSpins > 0 ? 'bonus-ready' : 'bonus-disabled'}`}
          title={remainingBonusSpins > 0 ? `You have ${remainingBonusSpins} bonus spin${remainingBonusSpins > 1 ? 's' : ''}!` : 'Wait for admin to push bonus spins'}
          disabled={remainingBonusSpins === 0}
        >
          🎰 Gnome Bonus{remainingBonusSpins > 0 ? ` (${remainingBonusSpins})` : ''}!
        </button>
      )}
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
  const participantRef = useRef(null); // Ref to trigger bonus modal in Participant component
  
  // Dark mode state (persisted in localStorage)
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('__gnomeville_dark_mode');
    return saved === 'true';
  });
  
  // Save dark mode preference
  useEffect(() => {
    localStorage.setItem('__gnomeville_dark_mode', darkMode);
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Check if this is a /gnome/:id URL or /discover or bonus subdomain
  const gnomeMatch = window.location.pathname.match(/\/gnome\/(\d+)/);
  const gnomeId = gnomeMatch ? parseInt(gnomeMatch[1], 10) : null;
  const isDiscoverPage = window.location.pathname === '/discover';
  const isBonusPage = window.location.hostname === 'bonus.gnomeville.app' || window.location.pathname === '/bonus';

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

  // If accessing bonus page, only allow participant or admin roles
  if (isBonusPage) {
    if (role !== 'participant' && role !== 'admin') {
      return (
        <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-6">
          <div className="max-w-md text-center">
            <h1 className="text-3xl font-black mb-4">🚫 Access Denied</h1>
            <p className="text-gray-700 mb-4">
              The Gnome Bonus page is only available to participants and administrators.
            </p>
            <a 
              href="https://gnomeville.app" 
              className="inline-block rounded bg-black text-white px-6 py-3 font-semibold hover:bg-gray-800"
            >
              Go to Main Site
            </a>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50">
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
          <window.Components.BonusPage user={user} role={role} />
        </main>
        <footer className="max-w-6xl mx-auto px-4 py-8 text-center text-[11px] text-gray-500">
          <span>© {new Date().getFullYear()} WildFlower FL • <a href="https://gnomeville.app" className="underline">gnomeville.app</a></span>
        </footer>
      </div>
    );
  }

  // If accessing universal discover page, show location-based finder
  if (isDiscoverPage) {
    const DiscoverPage = window.Components.DiscoverPage;
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
        <GlobalFX />
        <main className="max-w-6xl mx-auto px-4 pb-12 pt-6">
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
    <div className={`min-h-screen transition-colors duration-300 ${
      darkMode 
        ? 'dark bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900' 
        : 'bg-gradient-to-br from-blue-50 to-purple-50'
    }`}>
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
          <h1 className={`text-2xl md:text-3xl font-black flex items-center gap-2 ${darkMode ? 'text-white' : ''}`}>
            <img src="https://raw.githubusercontent.com/promos-cmyk/legendary-octo-broccoli/main/wildflower-favicon.png" alt="Wildflower" className="w-28 h-28 object-contain float-gnome"/>
            <span>WildFlower Gnomeville</span>
          </h1>
          <Tabs tab={tab} setTab={setTab} role={role} user={user} participantRef={participantRef}/>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 pb-10">
        {(role==='participant' || role==='admin') && tab==='participant' && <Participant user={user} ref={participantRef} darkMode={darkMode} setDarkMode={setDarkMode}/>}
        {(role==='advertiser' || role==='admin') && tab==='advertiser' && <Advertiser user={user} darkMode={darkMode}/>}
        {(role==='partners' || role==='admin') && tab==='partners' && <Partners user={user} darkMode={darkMode}/>}
        {role==='admin' && tab==='admin' && <Admin user={user} darkMode={darkMode} setDarkMode={setDarkMode}/>}
      </main>

      <footer className={`max-w-6xl mx-auto px-4 pb-8 text-[11px] ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <span>© {new Date().getFullYear()} WildFlower FL</span>
          <span>gnomeville.app • participants | partners.gnomeville.app • partners | advertisers.gnomeville.app • advertisers | admin.gnomeville.app • admin</span>
        </div>
      </footer>

      {needSignup && <window.Components.SignupModal role={role} onDone={finishSignup}/>}
    </div>
  );
}
