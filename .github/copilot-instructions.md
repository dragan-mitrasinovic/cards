# Cooperative Card Game — Copilot Instructions

## Project Overview

This is a cooperative 2-player browser card game. Players place cards face-down on a shared board, then cards are revealed. The goal is to collaboratively sort the dealt cards into the correct global order — without seeing each other's hands or communicating.

---

## General Rules

- **Never introduce a new language, framework, library, or dependency without asking first.** When a new dependency or tool is needed:
  1. Present all reasonable alternatives with pros and cons for each.
  2. Wait for explicit approval before proceeding with the chosen option.
  3. Once approved, update the Tech Stack section of this file (`copilot-instructions.md`) to reflect the new addition.
- This applies to everything: runtime dependencies, dev dependencies, frameworks, testing libraries, build tools, linters, etc.
- **After completing any item in `docs/PLAN.md`, update the checkbox from `[ ]` to `[x]` and commit the change.**

---

## Tech Stack

The tech stack is being defined iteratively. Only the items listed below are confirmed. Everything else is TBD — always ask before introducing anything new.

- **Platform:** Web application (browser-based)
- **Frontend:** Angular 21 (TypeScript)
- **Backend:** Go with gorilla/websocket (in `/server` directory)
- **Styling:** Tailwind CSS v4 (utility-first)
- **SSR/SSG:** Disabled (client-side only)
- **Testing:** Jasmine + Karma (Angular default)
- **Package Manager:** npm (frontend), Go modules (backend)

---

## Game Rules

### Deck & Deal

- The deck consists of 4 suits × 10 cards (numbered 1–10): **Hearts, Spades, Diamonds, Clubs**.
- Total deck size: 40 cards.
- At the start of a game, the deck is shuffled and each player is dealt **7 cards**.
- The remaining 26 cards are set aside and are not used for the rest of the game.
- Players cannot see each other's hands at any point.

### The Board

- The board has **15 slots**, arranged left to right in a single row.
- Only 14 cards will be placed (7 per player), so **one slot will always remain empty**.
- The empty slot is ignored when evaluating the final result.

### Turn Order Decision

Before gameplay begins, both players independently state one of:

1. "I want to go first"
2. "I'm neutral"
3. "I don't want to go first"

Players **can see their own hand** during this phase — the decision of who goes first is a strategic one based on the cards they hold.

The players must reach an agreement on who goes first based on these preferences. If both want to go first or both don't want to go first, the game must prompt them to resolve the conflict (e.g., re-pick or random tiebreak — implementation TBD).

### Placement Phase

- Players **strictly alternate turns**, starting with the agreed-upon first player.
- On their turn, a player selects one card from their hand and places it **face-down** on any **empty slot** on the board.
- Cards are placed face-down — neither player can see the values of any cards on the board.
- However, both players **can see which slots are occupied** (they just can't see the card values).
- A player **can click on a card they previously placed** to peek at its value (only their own cards).
- Each player has **exactly 1 pass** they may use during the placement phase. When a player passes:
  - They do not place a card that turn.
  - The other player takes the next turn, effectively playing twice in a row.
  - A pass is optional — a player does not have to use it.
  - An unused pass has no effect on the game.
- The placement phase ends when both players have placed all 7 of their cards (14 cards total on the board).

### Swaps

Players can suggest swaps **during the placement phase** and during the **swap phase** (after all cards are placed):

- A swap suggestion consists of choosing **any 2 occupied cards** on the board (the cards remain face-down).
- The **other player must agree** to the swap for it to happen. If they disagree, the swap does not occur.
- **During placement**: either player can suggest a swap at any time (not just on their turn). The game pauses until the partner responds. Suggesting a swap does **not** consume a turn.
- Each player can suggest **unlimited** swaps, but at most **1 accepted swap per player** across the entire game. Rejected swaps do not count toward the limit.
- Accepted swaps are visually marked with arrows linking the two swapped cards for the rest of the game.

### Swap Phase

After all cards are placed and before the reveal:

1. The player who went **first** in the placement phase gets to suggest a swap first.
2. Then the **second player** gets their swap opportunity.
3. If a player already had a swap accepted during placement, their turn is **automatically skipped**.
4. If both players already used their swap during placement, the swap phase is skipped entirely.

### Reveal Phase

- After the swap phase, cards are revealed **one by one**, from **left to right** across the board.
- Each card flips face-up in its slot on the board, one at a time, allowing for dramatic reveal animations.
- The empty slot is skipped/ignored.
- Functionally this is equivalent to revealing all at once — the sequential reveal is purely for presentation.

### Win Condition

- The players **win** if all 14 revealed cards, read left to right (skipping the empty slot), are in **correct relative sorted order**.
- The global sort order is: **Hearts < Spades < Diamonds < Clubs**, and within each suit, **1 < 2 < ... < 10**.
- Full sorted reference: H1, H2, ..., H10, S1, S2, ..., S10, D1, D2, ..., D10, C1, C2, ..., C10.
- Only the 14 dealt cards matter — they must appear in the same relative order as they would in the full sorted sequence above.
- If even one card is out of relative order, the players **lose**. There is no partial scoring.

### Communication

- Players are **not allowed to communicate** during the game (no hints about what cards they hold or where they are placing them).
- This rule may be relaxed in future versions.