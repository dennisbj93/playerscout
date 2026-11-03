import { useEffect, useState } from "react";
import { Link } from "react-router";
import type { Player } from "../../shared/types";
import { ageFrom, api } from "../lib/api";
import { canWrite, useMe } from "../App";

export default function Players() {
  const me = useMe();
  const [q, setQ] = useState("");
  const [players, setPlayers] = useState<Player[] | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      api.get<Player[]>(`/players${q ? `?q=${encodeURIComponent(q)}` : ""}`).then(setPlayers);
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <>
      <div className="row between">
        <h1>Spillere</h1>
        {canWrite(me) && (
          <Link className="button" to="/players/new">
            Ny spiller
          </Link>
        )}
      </div>
      <input className="search" placeholder="Søg på navn…" value={q} onChange={(e) => setQ(e.target.value)} />
      {players === null ? (
        <p className="muted">Indlæser…</p>
      ) : players.length === 0 ? (
        <p className="muted">Ingen spillere endnu.</p>
      ) : (
        <table className="list">
          <thead>
            <tr>
              <th>Navn</th>
              <th>Position</th>
              <th>Alder</th>
              <th>Klub</th>
              <th>Kontrakt til</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link to={`/players/${p.id}`}>{p.name}</Link>
                </td>
                <td>{p.position}</td>
                <td>{ageFrom(p.birthDate)}</td>
                <td>{p.currentClub}</td>
                <td>{p.contractUntil}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
