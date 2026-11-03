import { useEffect, useState } from "react";
import { Link } from "react-router";
import type { Report } from "../../shared/types";
import { api, formatDate, RECOMMENDATION_LABEL } from "../lib/api";

type Row = Report & { playerName: string };

export default function Reports() {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    api.get<Row[]>("/reports").then(setRows);
  }, []);

  return (
    <>
      <h1>Seneste rapporter</h1>
      {rows === null ? (
        <p className="muted">Indlæser…</p>
      ) : rows.length === 0 ? (
        <p className="muted">Ingen rapporter endnu. Opret en fra en spillerprofil.</p>
      ) : (
        <table className="list">
          <thead>
            <tr>
              <th>Spiller</th>
              <th>Kamp</th>
              <th>Scout</th>
              <th>Anbefaling</th>
              <th>Dato</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link to={`/players/${r.playerId}`}>{r.playerName}</Link>
                </td>
                <td>{r.matchDescription}</td>
                <td>{r.authorName}</td>
                <td>
                  <span className={`badge ${r.recommendation}`}>{RECOMMENDATION_LABEL[r.recommendation]}</span>
                </td>
                <td>{formatDate(r.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
