import { getFirestore, doc, getDoc } from "firebase/firestore";
import { app } from "./firebase";

const db = getFirestore(app);

export async function loadRole(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? (snap.data().role || "participant") : "participant";
}

export default loadRole;
