/* Local accounts. IMPORTANT: this stores accounts in this browser only (no server), so it is a sign-in
   experience, not real security. Before a public launch, swap these functions for a real provider
   (Supabase, Firebase Auth or your own API) and keep the same signatures. */
export interface User { id: string; name: string; email: string }
interface Rec extends User { salt: string; hash: string }
const USERS = "padaan.users.v1", SESSION = "padaan.session.v1", GUEST = "padaan.guest.v1";
const read = <T,>(k: string, f: T): T => { try { const s = localStorage.getItem(k); return s ? (JSON.parse(s) as T) : f; } catch { return f; } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } };
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
async function hash(pw: string, salt: string) {
  if (!globalThis.crypto?.subtle) return btoa(salt + pw);
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${pw}`)));
}
const pub = ({ id, name, email }: Rec): User => ({ id, name, email });
export const currentUser = (): User | null => read<User | null>(SESSION, null);
export const isGuest = () => read<boolean>(GUEST, false);
export const continueAsGuest = () => write(GUEST, true);
export const clearGuest = () => write(GUEST, false);
export function signOut() { write(SESSION, null); write(GUEST, false); }
export async function signUp(name: string, email: string, pw: string): Promise<User> {
  email = email.trim().toLowerCase(); name = name.trim();
  if (name.length < 2) throw new Error("Enter your name.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Enter a valid email address.");
  if (pw.length < 8) throw new Error("Use a password with at least 8 characters.");
  const users = read<Rec[]>(USERS, []);
  if (users.some((u) => u.email === email)) throw new Error("An account with this email already exists. Try signing in.");
  const salt = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const rec: Rec = { id: "u" + Date.now().toString(36), name, email, salt, hash: await hash(pw, salt) };
  write(USERS, [...users, rec]); write(SESSION, pub(rec)); write(GUEST, false);
  return pub(rec);
}
export async function signIn(email: string, pw: string): Promise<User> {
  email = email.trim().toLowerCase();
  const u = read<Rec[]>(USERS, []).find((x) => x.email === email);
  if (!u || u.hash !== (await hash(pw, u.salt))) throw new Error("Email or password is incorrect.");
  write(SESSION, pub(u)); write(GUEST, false);
  return pub(u);
}
