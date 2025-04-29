// src/app/game/page.tsx
import { getValidatedImagePath } from "@/lib/server/imageValidation";
import { deckCards } from "@/data/deckData";

export default async function GamePage() {
  // server-side preflight image checks
  await Promise.all(
    deckCards.map((card) => getValidatedImagePath(card.image))
  );

  return (
    // This will be rendered inside GameLayout → ClientLayout
    <div className="h-screen w-full flex items-center justify-center bg-slate-900 text-slate-200">
      <div className="text-xl">Initializing game…</div>
    </div>
  );
}
