import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";
import type { Shortlist } from "../../shared/types";
import { api } from "../lib/api";
import { canWrite, useMe } from "../App";

export default function Shortlists() {
  const me = useMe();
  const [lists, setLists] = useState<Shortlist[] | null>(null);
  const [name, setName] = useState("");

  const load = useCallback(() => {
    api.get<Shortlist[]>("/shortlists").then(setLists);
  }, []);
  useEffect(load, [load]);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    await api.post("/shortlists", { name });
    setName("");
    load();
  };

  return (
    <>
      <h1>Shortlists</h1>
      {canWrite(me) && (
        <form className="row" onSubmit={create}>
          <input placeholder="Fx Venstre back sommer 2027" value={name} onChange={(e) => setName(e.target.value)} required />
          <button type="submit">Opret</button>
        </form>
      )}
      {lists === null ? (
        <p className="muted">Indlæser…</p>
      ) : lists.length === 0 ? (
        <p className="muted">Ingen shortlists endnu.</p>
      ) : (
        <ul className="cards">
          {lists.map((l) => (
            <li key={l.id} className="card">
              <Link to={`/shortlists/${l.id}`}>{l.name}</Link>
              <span className="muted small"> · {l.playerCount ?? 0} spillere</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
