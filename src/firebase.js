import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, query, orderBy } from "firebase/firestore";
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
//
// IMPORTANTE: get() NO debe devolver null ni datos vacíos ante un error de
// red/permiso — eso hacía que la app pensara "este negocio no tiene
// productos todavía" y pisara el catálogo real con datos de muestra en el
// próximo guardado. Ahora, si falla la lectura, se propaga el error de
// verdad para que quien llama decida (nunca hay que asumir "está vacío").
export const storage = {
  async get(key) {
    const ref = doc(db, "posData", key);
    const snap = await getDoc(ref); // si falla, tira error de verdad (no lo tapamos)
    if (!snap.exists()) return null; // esto sí significa "todavía no existe", genuino
    return { key, value: snap.data().value };
  },
  async set(key, value) {
    const ref = doc(db, "posData", key);
    await setDoc(ref, { value, actualizado: new Date().toISOString() });
    return { key, value };
  },
};

// Copias de seguridad (backups). El backup automático de todos los días a
// las 16hs lo hace la Cloud Function "backupDiario" — esto de acá es lo que
// necesita el panel de Marcelo para listar, descargar y restaurar.
export const backupsApi = {
  async listar() {
    const q = query(collection(db, "backups"), orderBy("fecha", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },
  async guardar(id, datos, tipo) {
    const ref = doc(db, "backups", id);
    await setDoc(ref, { fecha: id, tipo: tipo || "manual", creado: new Date().toISOString(), datos });
  },
  async leerNegocioActual(negocioId) {
    const ref = doc(db, "posData", "negocio:" + negocioId);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data().value : null;
  },
  async restaurarNegocio(negocioId, valorJSON) {
    const ref = doc(db, "posData", "negocio:" + negocioId);
    await setDoc(ref, { value: valorJSON, actualizado: new Date().toISOString() });
  },
};
