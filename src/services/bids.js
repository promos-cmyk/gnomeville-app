import { auth } from "../firebase";

/**
 * Place a bid for a gnome.
 * Verifies local preconditions (card saved and authorization checked) before sending to backend.
 *
 * @param {{gnomeId: string|number, amount: number}} opts
 * @returns {Promise<any>} parsed response from server
 */
export async function placeBid({ gnomeId, amount }) {
  const cardSaved = JSON.parse(localStorage.getItem("gv_card_saved") || "false");
  const authChecked = JSON.parse(localStorage.getItem("gv_card_auth") || "false");
  if (!authChecked) throw new Error("Please check the charge authorization first.");
  if (!cardSaved) throw new Error("Please save a card before bidding.");

  try {
    const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
    const res = await fetch((import.meta.env.VITE_API_BASE || "") + "/bids/place", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ gnomeId, amount }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const err = new Error(`Bid failed: ${res.status} ${res.statusText}` + (text ? ` - ${text}` : ""));
      err.status = res.status;
      throw err;
    }

    // Try JSON, fall back to text
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) return res.json();
    return res.text();
  } catch (e) {
    console.error("placeBid error:", e);
    throw e;
  }
}

export default placeBid;
