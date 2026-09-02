import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyBcaNMKlCo83RgTy7xrMZe5bvZADFEdODk",
  authDomain: "pos-rastex.firebaseapp.com",
  projectId: "pos-rastex",
  storageBucket: "pos-rastex.firebasestorage.app",
  messagingSenderId: "368684352410",
  appId: "1:368684352410:web:38c3aaef196f3fffad7023",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const functionsInstance = getFunctions(app);

// Mapea el PIN de 4 dígitos que escribe la persona a un usuario real de Firebase Auth.
const CREDENCIALES_POR_PIN = {
  "0000": { email: "marcelo@rastexpos.local", password: "Rastex-Marcelo-26!" },
  "1234": { email: "luciana@rastexpos.local", password: "Rastex-Luciana-26!" },
};

export async function loginConPin(pin) {
  const cred = CREDENCIALES_POR_PIN[pin];
  if (!cred) return null;
  try {
    const res = await signInWithEmailAndPassword(auth, cred.email, cred.password);
    return res.user;
  } catch (e) {
    console.error("Error de login:", e);
    return null;
  }
}

export function logout() {
  return signOut(auth);
}

// Misma "forma" que el storage anterior (get/set con key/value),
// pero ahora leyendo y escribiendo de verdad en Firestore.
export const storage = {
  async get(key) {
    try {
      const ref = doc(db, "posData", key);
      const snap = await getDoc(ref);
      if (!snap.exists()) return null;
      return { key, value: snap.data().value };
    } catch (e) {
      console.error("storage.get error:", e);
      return null;
    }
  },
  async set(key, value) {
    try {
      const ref = doc(db, "posData", key);
      await setDoc(ref, { value, actualizado: new Date().toISOString() });
      return { key, value };
    } catch (e) {
      console.error("storage.set error:", e);
      return null;
    }
  },
};
