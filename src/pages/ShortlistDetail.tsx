import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import type { Player, Shortlist, ShortlistStatus } from "../../shared/types";
import { ageFrom, api, STATUS_LABEL } from "../lib/api";
import { canWrite, useMe } from "../App";

type Row = Player & { status: ShortlistStatus };

export default function ShortlistDetail() {
  const { id } = useParams();
  const me = useMe();
  const [data, setData] = useState<{ shortlist: Shortlist; players: Row[] } | null>(null);

  const load = useCallback(() => {
    api.get<{ shortlist: Shortlist; players: Row[] }>(`/shortlists/${id}`).then(setData);
  }, [id]);
  useEffect(load, [load]);

  if (!data) return <p className="muted">Indlæser…</p>;

  const setStatus = async (playerId: string, status: ShortlistStatus) => {
    await api.put(`/shortlists/${id}/players/${playerId}`, { status });
    load();
  };
  const remove = async (playerId: string) => {
    await api.del(`/shortlists/${id}/players/${playerId}`);
    load();
  };

  return (
    <>
      <h1>{data.shortlist.name}</h1>
      {data.players.length === 0 ? (
        <p className="muted">Ingen spillere endnu. Tilføj dem fra en spillerprofil.</p>
      ) : (
        <table className="list">
          <thead>
            <tr>
              <th>Spiller</th>
              <th>Position</th>
              <th>Alder</th>
              <th>Klub</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.players.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link to={`/players/${p.id}`}>{p.name}</Link>
                </td>
                <td>{p.position}</td>
                <td>{ageFrom(p.birthDate)}</td>
                <td>{p.currentClub}</td>
                <td>
                  {canWrite(me) ? (
                    <select value={p.status} onChange={(e) => setStatus(p.id, e.target.value as ShortlistStatus)}>
                      {(Object.keys(STATUS_LABEL) as ShortlistStatus[]).map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    STATUS_LABEL[p.status]
                  )}
                </td>
                <td>
                  {canWrite(me) && (
                    <button className="link" onClick={() => remove(p.id)}>
                      Fjern
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
