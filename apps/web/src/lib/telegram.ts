// Telegram Web App (bot ichida ochilganda) bilan ishlash.
type WebApp = {
  initData: string;
  ready(): void;
  expand(): void;
  close(): void;
  colorScheme?: "light" | "dark";
  BackButton?: { show(): void; hide(): void; onClick(cb: () => void): void; offClick(cb: () => void): void };
};

declare global {
  interface Window {
    Telegram?: { WebApp?: WebApp };
    onTelegramAuth?: (user: Record<string, string | number>) => void;
  }
}

export const webApp = () => (window.Telegram?.WebApp?.initData ? window.Telegram.WebApp : null);
export const insideTelegram = () => !!webApp();
