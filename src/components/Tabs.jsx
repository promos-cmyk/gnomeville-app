import React from 'react';
import { useAuth } from '../AuthContext';

function Tabs({ tab, setTab }){
  const { role } = useAuth();
  const btn = (k,label, allowed=true) => (
    <button disabled={!allowed}
      onClick={() => allowed && setTab(k)}
      className={`px-3 py-1.5 rounded-full border text-sm ${tab===k?'bg-black text-white':'bg-white hover:bg-gray-50'} ${!allowed?'opacity-50 cursor-not-allowed':''}`}>{label}</button>
  );
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {btn('participant','Participant', true)}
      {btn('partners','Partners', role==='partner' || role==='admin')}
      {btn('admin','Admin', role==='admin')}
    </div>
  );
}

export default Tabs;
