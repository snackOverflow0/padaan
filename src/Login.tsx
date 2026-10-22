import { useState, type FormEvent } from "react";
import { Icon } from "./icons";
import { continueAsGuest, signIn, signUp, type User } from "./auth";

export function LoginPage({ onDone }: { onDone: (u: User | null) => void }) {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState(""), [email, setEmail] = useState(""), [pw, setPw] = useState(""), [show, setShow] = useState(false);
  const [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr(""); setBusy(true);
    try { onDone(mode === "in" ? await signIn(email, pw) : await signUp(name, email, pw)); }
    catch (x) { setErr(x instanceof Error ? x.message : "Something went wrong. Try again."); setBusy(false); }
  };
  const guest = () => { continueAsGuest(); onDone(null); };
  return (
    <main className="lg">
      <aside className="lg-brand">
        <img src="/logo-full.png" alt="Padaan, the road there" />
        <h2>Know exactly how to get there.</h2>
        <ul>
          <li><Icon name="route" size={18} />Step-by-step jeepney, tricycle, bus and boat routes</li>
          <li><Icon name="map" size={18} />Real road maps from wherever you start</li>
          <li><Icon name="calendar" size={18} />A trip planner that builds your days for you</li>
        </ul>
      </aside>
      <section className="lg-card">
        <img className="lg-mark" src="/logo-mark.png" alt="" />
        <h1>{mode === "in" ? "Welcome back" : "Create your account"}</h1>
        <p className="lg-sub">{mode === "in" ? "Sign in to keep your saved places and trips." : "Save places, plan trips and go offline."}</p>
        <div className="lg-tabs" role="tablist">
          <button role="tab" aria-selected={mode === "in"} className={mode === "in" ? "on" : ""} onClick={() => { setMode("in"); setErr(""); }}>Sign in</button>
          <button role="tab" aria-selected={mode === "up"} className={mode === "up" ? "on" : ""} onClick={() => { setMode("up"); setErr(""); }}>Create account</button>
        </div>
        <form onSubmit={submit} noValidate>
          {mode === "up" && <label>Full name<input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Juan Dela Cruz" /></label>}
          <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" placeholder="you@example.com" /></label>
          <label>Password
            <span className="lg-pw"><input type={show ? "text" : "password"} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete={mode === "in" ? "current-password" : "new-password"} placeholder={mode === "up" ? "At least 8 characters" : "Your password"} />
              <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"}>{show ? "Hide" : "Show"}</button></span>
          </label>
          {err && <p className="lg-err" role="alert"><Icon name="alert" size={16} />{err}</p>}
          <button className="btn primary lg-submit" type="submit" disabled={busy}>{busy ? "Please wait…" : mode === "in" ? "Sign in" : "Create account"}</button>
        </form>
        <div className="lg-or"><span>or</span></div>
        <button className="btn secondary lg-guest" onClick={guest}>Continue as guest</button>
        <p className="lg-note"><Icon name="info" size={14} />In this version, accounts are stored on this device only.</p>
      </section>
    </main>
  );
}
