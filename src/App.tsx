import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes } from "react-router";
import type { Me } from "../shared/types";
import { api, ApiError } from "./lib/api";
import Login from "./pages/Login";
import Players from "./pages/Players";
import PlayerForm from "./pages/PlayerForm";
import PlayerDetail from "./pages/PlayerDetail";
import Reports from "./pages/Reports";
import Shortlists from "./pages/Shortlists";
import ShortlistDetail from "./pages/ShortlistDetail";
import Account from "./pages/Account";

const MeContext = createContext<Me | null>(null);
export const useMe = () => useContext(MeContext)!;
export const canWrite = (me: Me) => me.user.role !== "coach";

export default function App() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);

  const load = useCallback(() => {
    api
      .get<Me>("/me")
      .then(setMe)
      .catch((e) => (e instanceof ApiError && e.status === 401 ? setMe(null) : setMe(null)));
  }, []);
  useEffect(load, [load]);

  if (me === undefined) return <div className="center muted">Indlæser…</div>;
  if (me === null) return <Login onLogin={load} />;

  const logout = async () => {
    await api.post("/auth/logout");
    setMe(null);
  };

  return (
    <MeContext.Provider value={me}>
      <header className="topbar">
        <div className="brand">
          Playerscout <span className="tenant">{me.tenant.name}</span>
        </div>
        <nav>
          <NavLink to="/players">Spillere</NavLink>
          <NavLink to="/reports">Rapporter</NavLink>
          <NavLink to="/shortlists">Shortlists</NavLink>
        </nav>
        <NavLink to="/account" className="muted">
          {me.user.name}
        </NavLink>
        <button className="link" onClick={logout} title={me.user.email}>
          Log ud
        </button>
      </header>
      <main className="container">
        <Routes>
          <Route path="/" element={<Navigate to="/players" replace />} />
          <Route path="/players" element={<Players />} />
          <Route path="/players/new" element={<PlayerForm />} />
          <Route path="/players/:id" element={<PlayerDetail />} />
          <Route path="/players/:id/edit" element={<PlayerForm />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/shortlists" element={<Shortlists />} />
          <Route path="/shortlists/:id" element={<ShortlistDetail />} />
          <Route path="/account" element={<Account />} />
          <Route path="*" element={<p>Siden findes ikke.</p>} />
        </Routes>
      </main>
    </MeContext.Provider>
  );
}
