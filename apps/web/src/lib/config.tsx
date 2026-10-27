import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api";

export type Contacts = { phone?: string; telegram?: string; address?: string; email?: string; mapUrl?: string };
export type Config = {
  botUsername: string | null;
  site: { title?: string; tagline?: string } | null;
  contacts: Contacts | null;
  about: { text?: string } | null;
  regions: string[];
};

const Ctx = createContext<Config | null>(null);

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<Config | null>(null);
  useEffect(() => {
    api<Config>("/public/config")
      .then(setConfig)
      .catch(() => setConfig({ botUsername: null, site: null, contacts: null, about: null, regions: [] }));
  }, []);
  return <Ctx.Provider value={config}>{children}</Ctx.Provider>;
}

export const useConfig = () => useContext(Ctx);
export const siteTitle = (c: Config | null) => c?.site?.title || "Ustozlar jamoasi";
