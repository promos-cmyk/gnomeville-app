import React from "react";
import { useAuth } from "../AuthContext";
import { useGv } from "../App";
import { auth, RecaptchaVerifier, linkWithPhoneNumber } from "../firebase";

export default function Participant(){
  const { fbUser, signInGoogle } = useAuth();
  const { user, setUser } = useGv();

  async function handleVerifySignIn(){
    if (!fbUser) { await signInGoogle(); }
    // set verified true if Google sign-in succeeded
    setUser(u => ({ ...u, email: fbUser?.email || u.email, verified: !!fbUser?.email }));
  }

  async function verifyPhone(){
    if (!fbUser) return alert("Sign in with Google first.");
    if (!user?.phone) return alert("Please set your phone number first.");
    const recaptcha = new RecaptchaVerifier(auth, "recaptcha-container", { size: "invisible" });
    try{
      const confirmation = await linkWithPhoneNumber(fbUser, user.phone, recaptcha);
      const code = window.prompt("Enter the SMS code:");
      if (!code) return alert("No code entered.");
      await confirmation.confirm(code);
      alert("Phone verified.");
      setUser(u => ({ ...u, phoneVerified: true }));
    }catch(err){
      console.error(err);
      alert("Phone verification failed: " + (err.message || err));
    }
  }

  async function pushSubs(brand, next){
    try{
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
      await fetch((import.meta.env.VITE_API_BASE || "") + "/subscriptions/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          brand,
          email: next.email ? user.email : null,
          sms: next.sms ? user.phone : null,
          subscribeEmail: !!next.email,
          subscribeSms: !!next.sms
        })
      });
    }catch(e){ console.error(e); }
  }

  return (
    <div className="max-w-md mx-auto mt-10 p-5 border rounded-lg shadow-lg">
      <h1 className="text-2xl font-bold mb-4">Participant</h1>
      <div className="mb-4">Email: {user?.email || "(none)"}</div>
      <div className="mb-4">Verified: {String(user?.verified || false)}</div>
      <button
        className="px-4 py-2 bg-blue-600 text-white rounded"
        onClick={handleVerifySignIn}
      >
        Verify via Google
      </button>
  <div id="recaptcha-container" style={{ display: "none" }} />
      <button
        className="mt-4 px-4 py-2 bg-green-600 text-white rounded"
        onClick={verifyPhone}
      >
        Verify Phone
      </button>
      <div className="mt-6">
        <h2 className="font-semibold mb-2">Subscriptions</h2>
        <div className="mb-2">
          <label className="inline-flex items-center">
            <input
              type="checkbox"
              checked={!!user?.wf?.email}
              onChange={(e) => {
                const next = { ...user.wf, email: e.target.checked };
                setUser(u => ({ ...u, wf: next }));
                pushSubs("wildflower", next);
              }}
              className="mr-2"
            />
            Wildflower Email
          </label>
        </div>
        <div className="mb-2">
          <label className="inline-flex items-center">
            <input
              type="checkbox"
              checked={!!user?.wf?.sms}
              onChange={(e) => {
                const next = { ...user.wf, sms: e.target.checked };
                setUser(u => ({ ...u, wf: next }));
                pushSubs("wildflower", next);
              }}
              className="mr-2"
            />
            Wildflower SMS
          </label>
        </div>

        <div className="mb-2">
          <label className="inline-flex items-center">
            <input
              type="checkbox"
              checked={!!user?.hyve?.email}
              onChange={(e) => {
                const next = { ...user.hyve, email: e.target.checked };
                setUser(u => ({ ...u, hyve: next }));
                pushSubs("hyve", next);
              }}
              className="mr-2"
            />
            Hyve Email
          </label>
        </div>
        <div className="mb-2">
          <label className="inline-flex items-center">
            <input
              type="checkbox"
              checked={!!user?.hyve?.sms}
              onChange={(e) => {
                const next = { ...user.hyve, sms: e.target.checked };
                setUser(u => ({ ...u, hyve: next }));
                pushSubs("hyve", next);
              }}
              className="mr-2"
            />
            Hyve SMS
          </label>
        </div>
      </div>
    </div>
  );
}
