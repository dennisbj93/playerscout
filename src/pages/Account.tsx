import { useState, type FormEvent } from "react";
import { api, ROLE_LABEL } from "../lib/api";
import { useMe } from "../App";

export default function Account() {
  const me = useMe();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (next !== repeat) return setMsg({ ok: false, text: "De to nye kodeord er ikke ens." });
    if (next.length < 10) return setMsg({ ok: false, text: "Det nye kodeord skal være mindst 10 tegn." });
    try {
      await api.post("/auth/password", { currentPassword: current, newPassword: next });
      setCurrent("");
      setNext("");
      setRepeat("");
      setMsg({ ok: true, text: "Kodeordet er skiftet." });
    } catch {
      setMsg({ ok: false, text: "Det nuværende kodeord er forkert." });
    }
  };

  return (
    <>
      <h1>Min konto</h1>
      <div className="card facts">
        <div>
          <span className="muted">Navn</span>
          {me.user.name}
        </div>
        <div>
          <span className="muted">E-mail</span>
          {me.user.email}
        </div>
        <div>
          <span className="muted">Rolle</span>
          {ROLE_LABEL[me.user.role]}
        </div>
        <div>
          <span className="muted">Klub</span>
          {me.tenant.name}
        </div>
      </div>
      <form className="card form" onSubmit={submit} style={{ maxWidth: 420 }}>
        <h2 style={{ marginTop: 0 }}>Skift kodeord</h2>
        <label>
          Nuværende kodeord
          <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
        </label>
        <label>
          Nyt kodeord (mindst 10 tegn)
          <input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" required />
        </label>
        <label>
          Gentag nyt kodeord
          <input type="password" value={repeat} onChange={(e) => setRepeat(e.target.value)} autoComplete="new-password" required />
        </label>
        {msg && <p className={msg.ok ? "muted" : "error"}>{msg.text}</p>}
        <div className="row">
          <button type="submit">Skift kodeord</button>
        </div>
      </form>
    </>
  );
}
