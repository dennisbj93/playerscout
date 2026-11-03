import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";
import type { Player, Recommendation, Report, Shortlist } from "../../shared/types";
import { ageFrom, api, formatDate, RECOMMENDATION_LABEL } from "../lib/api";
import { canWrite, useMe } from "../App";

export default function PlayerDetail() {
  const { id } = useParams();
  const me = useMe();
  const [data, setData] = useState<{ player: Player; reports: Report[] } | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(() => {
    api
      .get<{ player: Player; reports: Report[] }>(`/players/${id}`)
      .then(setData)
      .catch(() => setNotFound(true));
  }, [id]);
  useEffect(load, [load]);

  if (notFound) return <p>Spilleren findes ikke.</p>;
  if (!data) return <p className="muted">Indlæser…</p>;
  const { player: p, reports } = data;
  const age = ageFrom(p.birthDate);
  const attrs = me.tenant.template.attributes;

  return (
    <>
      <div className="row between">
        <h1>{p.name}</h1>
        {canWrite(me) && (
          <Link className="button secondary" to={`/players/${p.id}/edit`}>
            Rediger
          </Link>
        )}
      </div>
      <div className="card facts">
        <Fact label="Position" value={p.position} />
        <Fact label="Alder" value={age !== null ? `${age} år` : null} />
        <Fact label="Nationalitet" value={p.nationality} />
        <Fact label="Fod" value={p.foot} />
        <Fact label="Klub" value={p.currentClub} />
        <Fact label="Kontrakt til" value={p.contractUntil} />
        {p.transfermarktUrl && (
          <div>
            <span className="muted">Transfermarkt</span>
            <a href={p.transfermarktUrl} target="_blank" rel="noreferrer">
              Åbn profil
            </a>
          </div>
        )}
      </div>
      {p.notes && <p className="notes">{p.notes}</p>}

      {canWrite(me) && <AddToShortlist playerId={p.id} />}

      <div className="row between">
        <h2>Rapporter ({reports.length})</h2>
        {canWrite(me) && !showForm && <button onClick={() => setShowForm(true)}>Ny rapport</button>}
      </div>
      {showForm && (
        <ReportForm
          playerId={p.id}
          onDone={() => {
            setShowForm(false);
            load();
          }}
        />
      )}
      {reports.length === 0 && !showForm && <p className="muted">Ingen rapporter endnu.</p>}
      {reports.map((r) => (
        <article key={r.id} className="card report">
          <div className="row between">
            <strong>
              {r.matchDescription || "Rapport"} {r.matchDate && <span className="muted">· {formatDate(r.matchDate)}</span>}
            </strong>
            <span className={`badge ${r.recommendation}`}>{RECOMMENDATION_LABEL[r.recommendation]}</span>
          </div>
          <p className="muted small">
            {r.authorName} · {formatDate(r.createdAt)}
            {r.positionPlayed && ` · spillede ${r.positionPlayed}`}
            {r.overall && ` · samlet ${r.overall}/10`}
          </p>
          <div className="ratings">
            {attrs.map((a) =>
              r.ratings[a.key] ? (
                <span key={a.key}>
                  {a.label} <b>{r.ratings[a.key]}</b>/5
                </span>
              ) : null,
            )}
          </div>
          <p className="summary">{r.summary}</p>
        </article>
      ))}
    </>
  );
}

function Fact({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <span className="muted">{label}</span>
      {value}
    </div>
  );
}

function ReportForm({ playerId, onDone }: { playerId: string; onDone: () => void }) {
  const me = useMe();
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [f, setF] = useState({ matchDescription: "", matchDate: "", positionPlayed: "", overall: "", summary: "" });
  const [recommendation, setRecommendation] = useState<Recommendation>("follow");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/reports", {
        playerId,
        ...f,
        overall: f.overall ? Number(f.overall) : null,
        ratings,
        recommendation,
      });
      onDone();
    } catch {
      setError("Kunne ikke gemme rapporten.");
    }
  };

  return (
    <form className="card form" onSubmit={submit}>
      <div className="grid2">
        <label>
          Kamp
          <input placeholder="Fx EfB - AaB" value={f.matchDescription} onChange={(e) => setF({ ...f, matchDescription: e.target.value })} />
        </label>
        <label>
          Dato
          <input type="date" value={f.matchDate} onChange={(e) => setF({ ...f, matchDate: e.target.value })} />
        </label>
        <label>
          Spillede som
          <input value={f.positionPlayed} onChange={(e) => setF({ ...f, positionPlayed: e.target.value })} />
        </label>
        <label>
          Samlet vurdering (1-10)
          <input type="number" min={1} max={10} value={f.overall} onChange={(e) => setF({ ...f, overall: e.target.value })} />
        </label>
      </div>
      <fieldset>
        <legend>Egenskaber (1-5)</legend>
        {me.tenant.template.attributes.map((a) => (
          <div key={a.key} className="rating-row">
            <span>{a.label}</span>
            <div className="scale">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  type="button"
                  key={n}
                  className={ratings[a.key] === n ? "on" : ""}
                  onClick={() => setRatings({ ...ratings, [a.key]: n })}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        ))}
      </fieldset>
      <label>
        Anbefaling
        <select value={recommendation} onChange={(e) => setRecommendation(e.target.value as Recommendation)}>
          {(Object.keys(RECOMMENDATION_LABEL) as Recommendation[]).map((k) => (
            <option key={k} value={k}>
              {RECOMMENDATION_LABEL[k]}
            </option>
          ))}
        </select>
      </label>
      <label>
        Vurdering
        <textarea rows={6} required value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} />
      </label>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button type="submit">Gem rapport</button>
        <button type="button" className="secondary" onClick={onDone}>
          Annuller
        </button>
      </div>
    </form>
  );
}

function AddToShortlist({ playerId }: { playerId: string }) {
  const [lists, setLists] = useState<Shortlist[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    api.get<Shortlist[]>("/shortlists").then(setLists);
  }, []);
  if (!lists.length) return null;
  return (
    <div className="row">
      <select
        defaultValue=""
        onChange={async (e) => {
          const listId = e.target.value;
          if (!listId) return;
          await api.put(`/shortlists/${listId}/players/${playerId}`, { status: "watching" });
          setMsg(`Tilføjet til ${lists.find((l) => l.id === listId)?.name}`);
          e.target.value = "";
        }}
      >
        <option value="">Tilføj til shortlist…</option>
        {lists.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
      {msg && <span className="muted small">{msg}</span>}
    </div>
  );
}
