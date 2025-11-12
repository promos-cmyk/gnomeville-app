import { useLocalStorage } from "./useLocalStorage";

// Safe fallbacks in case these are provided elsewhere in the app (global or module)
const safeGNOMES = typeof globalThis !== "undefined" && Array.isArray(globalThis.GNOMES) ? globalThis.GNOMES : [];
const safeMonthKey = (typeof globalThis !== "undefined" && typeof globalThis.monthKey === "function")
  ? globalThis.monthKey
  : () => {
      // fallback month key like YYYYMM
      const d = new Date();
      return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
    };

export function useGvStorage() {
  const [user, setUser] = useLocalStorage("gv_user", {
    email: "", phone: "", verified: false,
    hyve: { email: false, sms: false },
    wf: { email: false, sms: false }
  });

  const [locks, setLocks] = useLocalStorage("gv_locks", {
    hyve: { on:false, startedAt:null, totalDays:0, lastSpanDays:undefined },
    wf:   { on:false, startedAt:null, totalDays:0, lastSpanDays:undefined },
  });

  const [interest, setInterest]   = useLocalStorage("gv_interest", { hyve: 0, wf: 0 });
  const [found, setFound]         = useLocalStorage("gv_found", []);
  const [sequence, setSequence]   = useLocalStorage("gv_sequence", []);
  const [orderedSeq, setOrderedSeq]=useLocalStorage("gv_orderedSeq", []);
  const [photoOk, setPhotoOk]     = useLocalStorage("gv_photoOk", {});

  const defaultCouponCodes = (safeGNOMES && safeGNOMES.length)
    ? Object.fromEntries(safeGNOMES.map(g => [g.id, `GV-${String(g.id).padStart(2,"0")}-${safeMonthKey()}`]))
    : {};

  const [couponCodes, setCouponCodes] = useLocalStorage("gv_couponCodes", defaultCouponCodes);

  return {
    user, setUser,
    locks, setLocks,
    interest, setInterest,
    found, setFound,
    sequence, setSequence,
    orderedSeq, setOrderedSeq,
    photoOk, setPhotoOk,
    couponCodes, setCouponCodes,
  };
}

export default useGvStorage;
