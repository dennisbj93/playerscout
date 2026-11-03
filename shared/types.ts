// Delte typer mellem API (worker) og web-app (src).

export const ROLES = ["admin", "chefscout", "scout", "coach"] as const;
export type Role = (typeof ROLES)[number];

export const RECOMMENDATIONS = ["sign", "follow", "reject"] as const;
export type Recommendation = (typeof RECOMMENDATIONS)[number];

export const SHORTLIST_STATUSES = ["watching", "priority", "contacted", "rejected"] as const;
export type ShortlistStatus = (typeof SHORTLIST_STATUSES)[number];

/** Klubbens rapportskabelon: hvilke egenskaber der vurderes (1-5). */
export interface ReportTemplate {
  attributes: { key: string; label: string }[];
}

export const DEFAULT_TEMPLATE: ReportTemplate = {
  attributes: [
    { key: "technique", label: "Teknik" },
    { key: "pace", label: "Fart" },
    { key: "physical", label: "Fysik" },
    { key: "tactical", label: "Taktisk forståelse" },
    { key: "mentality", label: "Mentalitet" },
    { key: "potential", label: "Potentiale" },
  ],
};

export interface Me {
  user: { id: string; name: string; email: string; role: Role };
  tenant: { id: string; name: string; slug: string; template: ReportTemplate };
}

export interface Player {
  id: string;
  name: string;
  birthDate: string | null;
  nationality: string | null;
  position: string | null;
  foot: string | null;
  currentClub: string | null;
  contractUntil: string | null;
  transfermarktUrl: string | null;
  wyscoutId: string | null;
  instatId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Report {
  id: string;
  playerId: string;
  authorId: string;
  authorName?: string;
  matchDescription: string | null;
  matchDate: string | null;
  positionPlayed: string | null;
  ratings: Record<string, number>;
  overall: number | null;
  recommendation: Recommendation;
  summary: string;
  createdAt: string;
}

export interface Shortlist {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  playerCount?: number;
}
