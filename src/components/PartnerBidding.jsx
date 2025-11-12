import React from "react";
import { useAuth } from "../AuthContext";
import { Elements, CardElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

const stripePromise = import.meta.env.VITE_STRIPE_PK ? loadStripe(import.meta.env.VITE_STRIPE_PK) : null;

function SaveCardBox(){
  const stripe = useStripe();
  const elements = useElements();
  const [authorized, setAuthorized] = React.useState(() => JSON.parse(localStorage.getItem("gv_card_auth")||"false"));
  const { fbUser } = useAuth();
  const API_BASE = import.meta.env.VITE_API_BASE || "";
  const isLocalTest = !API_BASE || API_BASE.includes("<") || API_BASE === "";

  async function saveCard(){
    if (!authorized) return alert("Please check the authorization box first.");
    if (!fbUser) return alert("Please sign in first.");

    // Local test mode: simulate a successful save without calling the server/Stripe
    if (isLocalTest) {
      // mark card as saved locally so other flows can proceed during dev
      localStorage.setItem("gv_card_saved","true");
      alert("(Test mode) Card save simulated successfully.");
      return;
    }

    if (!stripe || !elements) return alert("Stripe has not loaded yet.");

    try{
      const token = await fbUser.getIdToken();
      const res = await fetch((import.meta.env.VITE_API_BASE||"") + "/stripe/setup-intent", {
        method:"POST", headers:{ "Content-Type":"application/json", Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(`Setup intent request failed: ${res.status}`);
      const { client_secret } = await res.json();
      const result = await stripe.confirmCardSetup(client_secret, { payment_method: { card: elements.getElement(CardElement) }});
      if (result.error) return alert(result.error.message);
      alert("Card saved for future charges.");
      localStorage.setItem("gv_card_saved","true");
    }catch(err){
      console.error(err);
      alert("Failed to save card: " + (err.message || err));
    }
  }

  return (
    <div className="rounded-2xl border p-3 shadow-sm bg-white mb-3">
      <label className="flex items-center gap-2 text-xs mb-2">
        <input type="checkbox" checked={authorized} onChange={e => { setAuthorized(e.target.checked); localStorage.setItem("gv_card_auth", JSON.stringify(e.target.checked)); }} />
        I authorize my card to be charged for my winning bid amount.
      </label>
      {!isLocalTest ? (
        <>
          <div className="rounded border p-2"><CardElement /></div>
          <button className="mt-2 rounded bg-black text-white px-2 py-1" onClick={saveCard}>Save Card</button>
        </>
      ) : (
        <>
          <div className="rounded border p-2 text-sm text-gray-600">Test mode: no API base configured. Clicking the button will simulate saving a card locally.</div>
          <button className="mt-2 rounded bg-blue-600 text-white px-2 py-1" onClick={saveCard}>Simulate Save Card (local)</button>
        </>
      )}
    </div>
  );
}

export default function PartnerBidding(){
  return (
    <Elements stripe={stripePromise}>
      <SaveCardBox />
    </Elements>
  );
}
