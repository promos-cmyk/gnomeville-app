const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();

// Read Stripe secret from Firebase Functions config (set via `firebase functions:config:set`)
const stripe = require("stripe")(functions.config().stripe?.secret || process.env.STRIPE_SECRET_KEY);
// add your Mailchimp and Twilio SDK clients here

// Auth guard
async function requireUser(req, res, next){
  const hdr = req.get("Authorization")||"";
  const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
  if (!token) return res.status(401).send("No token");
  try {
    req.user = await admin.auth().verifyIdToken(token);
    next();
  } catch { return res.status(401).send("Invalid token"); }
}

// 1) Save card (SetupIntent)
exports.setupIntent = functions.https.onRequest(async (req, res) => {
  await new Promise((resolve) => requireUser(req, res, resolve));
  const customerId = await getOrCreateCustomer(req.user);
  const intent = await stripe.setupIntents.create({ customer: customerId, payment_method_types:["card"] });
  res.json({ client_secret: intent.client_secret });
});

async function getOrCreateCustomer(user){
  const ref = db.collection("users").doc(user.uid);
  const snap = await ref.get();
  let data = snap.data() || {};
  if (!data.stripeCustomerId) {
    const customer = await stripe.customers.create({ email: user.email, metadata: { uid: user.uid }});
    data.stripeCustomerId = customer.id;
    await ref.set(data, { merge: true });
  }
  return data.stripeCustomerId;
}

// 2) Record a bid
exports.placeBid = functions.https.onRequest(async (req,res) => {
  await new Promise((resolve) => requireUser(req,res,resolve));
  const { gnomeId, amount } = req.body || {};
  if (!(gnomeId>0) || !(amount>0)) return res.status(400).send("Bad input");
  await db.collection("bids").add({ uid: req.user.uid, gnomeId, amount, ts: admin.firestore.FieldValue.serverTimestamp() });
  res.json({ ok:true });
});

// 3) Update subscriptions
exports.updateSubscription = functions.https.onRequest(async (req,res) => {
  await new Promise((resolve) => requireUser(req,res,resolve));
  const { brand, email, sms, subscribeEmail, subscribeSms } = req.body || {};
  // do Mailchimp upsert/remove to the brand's audience
  // do Twilio (or your SMS provider) upsert/remove
  return res.json({ ok:true });
});

// 4) Charge winners (scheduled daily, charges at month-end)
exports.chargeWinners = functions.pubsub.schedule("every day 01:00").timeZone("America/New_York").onRun(async () => {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
  if (now.getDate() !== lastDay) return; // only run on last day

  // for each gnome, find top bid this month
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const bidsSnap = await db.collection("bids")
    .where("ts", ">=", start)
    .get();

  const topByGnome = {};
  bidsSnap.forEach(doc => {
    const { gnomeId, amount, uid } = doc.data();
    if (!topByGnome[gnomeId] || amount > topByGnome[gnomeId].amount) {
      topByGnome[gnomeId] = { amount, uid };
    }
  });

  for (const [gnomeId, { amount, uid }] of Object.entries(topByGnome)) {
    const userRef = db.collection("users").doc(uid);
    const userDoc = await userRef.get();
    const data = userDoc.data() || {};
    const customerId = data.stripeCustomerId;
    if (!customerId) continue;

    // charge off-session
    await stripe.paymentIntents.create({
      amount: Math.round(Number(amount) * 100),
      currency: "usd",
      customer: customerId,
      confirm: true,
      off_session: true,
      automatic_payment_methods: { enabled: true },
      description: `Winning bid for Gnome #${gnomeId}`
    });
  }
});
