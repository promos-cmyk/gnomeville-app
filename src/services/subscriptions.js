/**
 * Client helper to update a user's subscription preferences.
 * POSTs the payload to POST /subscriptions/update
 *
 * Body shape:
 * {
 *   brand: "wildflower" | "hyve",
 *   email: string,
 *   sms: string, // E.164
 *   subscribeEmail: boolean,
 *   subscribeSms: boolean
 * }
 */

/**
 * Update subscription preferences on the server.
 *
 * @param {Object} opts
 * @param {"wildflower"|"hyve"} opts.brand
 * @param {string} opts.email
 * @param {string} opts.sms
 * @param {boolean} opts.subscribeEmail
 * @param {boolean} opts.subscribeSms
 * @param {string} [baseUrl] optional base URL for the API (defaults to same origin)
 * @returns {Promise<any>} parsed JSON response
 */
export async function updateSubscription({ brand, email, sms, subscribeEmail, subscribeSms }, baseUrl = "") {
  if (!brand || (brand !== "wildflower" && brand !== "hyve")) {
    throw new TypeError('brand must be "wildflower" or "hyve"');
  }

  const body = {
    brand,
    email: email || "",
    sms: sms || "",
    subscribeEmail: !!subscribeEmail,
    subscribeSms: !!subscribeSms,
  };

  const url = `${baseUrl}/subscriptions/update`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include", // send cookies when same-origin
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`Request failed: ${res.status} ${res.statusText}` + (text ? ` - ${text}` : ""));
    err.status = res.status;
    throw err;
  }

  // Try to parse JSON, but fall back to text if not JSON
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return res.text();
}

export default updateSubscription;
