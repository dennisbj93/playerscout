import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router";
import type { Player } from "../../shared/types";
import { api } from "../lib/api";

const FIELDS: { key: keyof Player; label: string; type?: string }[] = [
  { key: "name", label: "Navn" },
  { key: "position", label: "Position" },
  { key: "birthDate", label: "Fødselsdato", type: "date" },
  { key: "nationality", label: "Nationalitet" },
  { key: "foot", label: "Fod" },
  { key: "currentClub", label: "Nuværende klub" },
  { key: "contractUntil", label: "Kontrakt til", type: "date" },
  { key: "transfermarktUrl", label: "Transfermarkt-link", type: "url" },
  { key: "wyscoutId", label: "Wyscout-ID" },
  { key: "instatId", label: "InStat-ID" },
];

type FormState = Record<string, string>;

export default function PlayerForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api.get<{ player: Player }>(`/players/${id}`).then(({ player }) => {
      const f: FormState = {};
      for (const { key } of FIELDS) f[key] = (player[key] as string | null) ?? "";
      f.notes = player.notes ?? "";
      setForm(f);
    });
  }, [id]);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (id) {
        await api.put(`/players/${id}`, form);
        navigate(`/players/${id}`);
      } else {
        const { id: newId } = await api.post<{ id: string }>("/players", form);
        navigate(`/players/${newId}`);
      }
    } catch {
      setError("Kunne ikke gemme. Tjek felterne.");
    }
  };

  return (
    <form className="card form" onSubmit={submit}>
      <h1>{id ? "Rediger spiller" : "Ny spiller"}</h1>
      <div className="grid2">
        {FIELDS.map((f) => (
          <label key={f.key}>
            {f.label}
            <input
              type={f.type ?? "text"}
              value={form[f.key] ?? ""}
              onChange={(e) => set(f.key, e.target.value)}
              required={f.key === "name"}
            />
          </label>
        ))}
      </div>
      <label>
        Noter
        <textarea rows={4} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
      </label>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button type="submit">Gem</button>
        <button type="button" className="secondary" onClick={() => navigate(-1)}>
          Annuller
        </button>
      </div>
    </form>
  );
}
