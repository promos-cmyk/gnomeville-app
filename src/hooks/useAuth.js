import { createContext, useContext, useEffect, useState } from "react";
import { auth, googleProvider, signInWithPopup } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { loadRole } from "../roles";

const AuthCtx = createContext(null);
export function useAuth(){ return useContext(AuthCtx); }

export default function AuthProvider({ children }){
    const [fbUser, setFbUser] = useState(null);
    const [role, setRole] = useState("participant"); // default; update from Firestore later

        useEffect(() => onAuthStateChanged(auth, async (u) => {
            setFbUser(u || null);
            setRole("participant");
            if (u) setRole(await loadRole(u.uid));
        }), []);

    const signInGoogle = async () => {
        await signInWithPopup(auth, googleProvider);
    };
    const signOut = async () => { await auth.signOut(); };

    return <AuthCtx.Provider value={{ fbUser, role, setRole, signInGoogle, signOut }}>
        {children}
    </AuthCtx.Provider>;
}