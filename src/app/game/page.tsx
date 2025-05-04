// src/app/game/page.tsx
import { getValidatedImagePath } from "@/lib/server/imageValidation";
import { deckCards } from "@/data/deckData";

export default async function GamePage() {
  // server-side preflight image checks (keep this)
  await Promise.all(
    deckCards.map((card) => getValidatedImagePath(card.image))
  );

  return (
    // REMOVE hardcoded bg-slate-900 text-slate-200
    // Let the background and foreground colors be inherited from the body/CSS vars
    <div className="h-screen w-full flex items-center justify-center">
      {/* Keep text styling simple, or use theme foreground color */}
      <div className="text-xl">Initializing game…</div>
    </div>
  );
}