// src/app/page.tsx
import { getValidatedImagePath } from "@/lib/server/imageValidation";
import { cards as deckCards } from "@/data/deckData";
// import the server component that does the checks
import GamePage from "./game/page";
// import the client boundary
import GameLayout from "./game/layout";

// export your metadata here (server-only)
export const metadata = {
  title: "Urban Development Game",
  description: "A strategic game about urban planning and community development",
};

export default async function Page() {
  // run the same server-side image validation
  interface DeckCard {
    image: string;
  }

  await Promise.all(
    deckCards.map(card => getValidatedImagePath(card.image ?? ''))
  );    

  // render inside the existing client layout
  return (
    <GameLayout>
      {/* GamePage is an async server component that returns your loading UI */}
      <GamePage />
    </GameLayout>
  );
}
