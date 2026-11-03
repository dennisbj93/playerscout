import type { Scoped } from "./db/scoped";
import type { Role, ReportTemplate } from "../shared/types";

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
}

export interface SessionInfo {
  user: { id: string; name: string; email: string; role: Role };
  tenant: { id: string; name: string; slug: string; template: ReportTemplate };
}

export type AppEnv = {
  Bindings: Env;
  Variables: {
    session: SessionInfo;
    data: Scoped;
  };
};
