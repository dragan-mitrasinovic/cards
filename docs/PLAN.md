# Cards — Project Plan

> Cooperative 2-player browser card game. Players place cards face-down on a shared 15-slot board, then reveal them. The goal is to collaboratively sort the dealt cards into the correct global order — without seeing each other's hands or communicating.

## Design Decisions

| Decision | Choice |
|---|---|
| Multiplayer | WebSocket (gorilla/websocket) |
| Backend | Go, in `/server` directory (same repo) |
| Lobby | Room codes + shareable links |
| State authority | Server-authoritative |
| Persistence | In-memory only (MVP) |
| Disconnection | Grace period (~30–60s) to reconnect |
| Turn conflicts | Transparent re-pick (both see each other's choice, loop until resolved) |
| Turn timer | None |
| Card visuals | Simple CSS placeholders (illustrated art later) |
| Animations | Yes — placement, flips, swaps, reveal |
| Responsive | Desktop + mobile equally |
| Player identity | Names entered at join, no accounts |
| Post-game | "Play Again" rematch with same players |

---

## Architecture

```
┌─────────────────────────┐        WebSocket        ┌─────────────────────────┐
│   Angular Frontend      │◄──────────────────────►  │   Go Backend            │
│   (Browser - Player A)  │                          │   /server               │
└─────────────────────────┘                          │                         │
                                                     │  - Room management      │
┌─────────────────────────┐        WebSocket        │  - Game state machine   │
│   Angular Frontend      │◄──────────────────────►  │  - Card dealing/shuffle │
│   (Browser - Player B)  │                          │  - Action validation    │
└─────────────────────────┘                          │  - State broadcasting   │
                                                     └─────────────────────────┘
```

---

## Backend (Go) — Components

### WebSocket Server (`/server`)
- HTTP server with WebSocket upgrade endpoint
- Connection manager: track active connections, map to players/rooms
- Message router: parse incoming JSON messages, dispatch to game logic
- Heartbeat/ping-pong for connection health

### Room Manager
- **Create room**: Generate short room code (4–6 alphanumeric chars) + game ID for shareable link
- **Join room**: Validate room code or game ID, assign player to room
- **Room lifecycle**: Created → Waiting → In Progress → Game Over → Rematch or Cleanup
- **Cleanup**: Remove rooms after both players leave or after inactivity timeout

### Game State Machine

```
LOBBY (waiting for 2nd player)
  → TURN_ORDER_PICK (both players pick preference)
  → TURN_ORDER_CONFLICT (if both want/don't want first — re-pick, transparent)
  → PLACEMENT_PHASE (alternating turns, 7 cards each)
  → SWAP_PHASE (first player suggests → accept/reject → second player's turn)
  → REVEAL_PHASE (sequential reveal, lowest to highest)
  → GAME_OVER (win/lose)
  → LOBBY or REMATCH
```

### Game Logic
- **Deck**: 4 suits × 10 cards = 40. Shuffle, deal 7 each.
- **Sort order**: H1..H10, S1..S10, D1..D10, C1..C10
- **Placement validation**: Correct turn, card in hand, slot empty
- **Pass**: Each player gets exactly 1
- **Swap validation**: Two adjacent occupied slots, other player must agree
- **Win check**: 14 revealed cards left→right (skip empty) in correct relative order
- **Peek**: Player can view own placed cards (server verifies ownership)

### Message Protocol (JSON over WebSocket)

**Client → Server:**

| Message | Payload | Phase |
|---|---|---|
| `join` | `{ name, roomCode? }` | Lobby |
| `turn_order_pick` | `{ preference: "first" \| "neutral" \| "no_first" }` | Turn Order |
| `place_card` | `{ cardId, slotIndex }` | Placement |
| `pass` | `{}` | Placement |
| `peek` | `{ slotIndex }` | Placement |
| `suggest_swap` | `{ slotA, slotB }` | Swap |
| `skip_swap` | `{}` | Swap |
| `respond_swap` | `{ accept: boolean }` | Swap |
| `play_again` | `{}` | Game Over |

**Server → Client:**

| Message | Payload | Notes |
|---|---|---|
| `room_created` | `{ roomCode, playerNumber }` | After creation |
| `player_joined` | `{ playerName, playerNumber, partnerName }` | Both notified |
| `turn_order_prompt` | `{}` | Ask for preference |
| `turn_order_result` | `{ picks, conflict?, firstPlayer? }` | Transparent |
| `game_start` | `{ hand: Card[], firstPlayer }` | Own hand only |
| `your_turn` | `{}` | Prompt active player |
| `card_placed` | `{ slotIndex, byPlayer }` | No value — face down |
| `player_passed` | `{ byPlayer }` | Notify pass used |
| `peek_result` | `{ slotIndex, card }` | Only to requester |
| `swap_prompt` | `{ byPlayer }` | Swap player's turn |
| `swap_suggested` | `{ slotA, slotB }` | Accept/reject prompt |
| `swap_result` | `{ accepted, slotA?, slotB? }` | Both notified |
| `reveal_card` | `{ slotIndex, card, delay }` | One at a time |
| `game_result` | `{ win: boolean, board: Card[] }` | Final result |
| `player_disconnected` | `{ playerName }` | Grace period started |
| `player_reconnected` | `{ playerName }` | Grace period cancelled |
| `error` | `{ message }` | Validation errors |

---

## Frontend (Angular) — Components

### Pages / Routes

| Route | Component | Description |
|---|---|---|
| `/` | `HomeComponent` | Landing — Create or Join game |
| `/game/:id` | `GameComponent` | Main game view (shareable link entry) |

### Core Components

- **`HomeComponent`** — Enter name, create game (shows code + link), or join via code. Auto-joins if arriving via shareable link.
- **`GameComponent`** — Phase orchestrator. Contains sub-components per phase. Displays partner info, connection status.
- **`TurnOrderPickComponent`** — Three-button pick UI. Shows waiting state, then both choices transparently. Re-pick on conflict.
- **`BoardComponent`** — 15 slots (empty / face-down / face-up). Click to place or peek. Responsive layout.
- **`HandComponent`** — Player's cards at bottom. Select → click slot to place. Scrollable on mobile.
- **`CardComponent`** — Single card (face-up/down). CSS 3D flip animation. Suit+number display.
- **`SwapPhaseComponent`** — Click two adjacent slots to suggest swap, or skip. Accept/reject UI for partner's suggestion.
- **`RevealComponent`** — Staggered flip animation. Pause between reveals.
- **`GameOverComponent`** — Win/lose message. Play Again + Leave buttons.

### Services

- **`WebSocketService`** — Connection lifecycle, observable message streams, typed send, reconnection logic, status indicator.
- **`GameStateService`** — Local game state mirror synced from server. Current phase, turn, board, hand. Signals/observables for UI.

### UI/UX

- **Desktop**: 15 slots in single horizontal row (~80×120px cards)
- **Mobile**: Horizontal scroll with snap, or 2-row layout
- **Animations**: Slide (placement), 3D flip (reveal/peek), swap slide, staggered reveal
- **Player bar**: Names, turn indicator, pass status, connection dot

---

## Game Flow (User Journey)

1. Player A opens app → enters name → "Create Game"
2. Sees room code + shareable link → sends to friend
3. Player B opens link (or enters code) → enters name → joins
4. **Turn Order**: Both pick preference, see each other's choice, re-pick if conflict
5. **Placement**: Alternate turns placing cards face-down. Can peek own cards. 1 pass each.
6. **Swap**: First player suggests swap (2 adjacent) or skips → other accepts/rejects → second player's turn
7. **Reveal**: Cards flip one by one, lowest to highest
8. **Result**: WIN or LOSE → "Play Again" or "Leave"

---

## Implementation Progress

### Phase 1: Project Setup & Skeleton
- [x] Go server skeleton in `/server` with gorilla/websocket
- [x] Angular routing — `HomeComponent` (`/`) and `GameComponent` (`/game/:id`)
- [x] Basic WebSocket connection between frontend and backend
- [x] Room creation & joining (room codes + shareable links)

### Phase 2: Core Game Loop
- [x] Deck, shuffle, deal logic (server)
- [x] Turn order pick phase (transparent re-pick on conflict)
- [x] Placement phase (alternating turns, validation, pass mechanic)
- [x] Board and hand rendering (frontend)

### Phase 3: Swap & Reveal
- [x] Swap phase logic (suggest, accept/reject, skip)
- [x] Reveal phase (sequential flip animation)
- [ ] Win/lose evaluation
- [ ] Game over screen + rematch

### Phase 4: Polish & UX
- [ ] Card flip/placement/swap animations
- [ ] Peek at own placed cards
- [ ] Responsive layout (mobile support)
- [ ] Connection status indicator
- [ ] Reconnection with grace period
- [ ] Disconnection handling

### Phase 5: Art & Final Polish
- [ ] Replace CSS placeholder cards with illustrated art
- [ ] Sound effects (future)
- [ ] Final UX polish, edge cases, testing

---

## Open Items / Future Considerations
- Spectator mode
- Post-game chat (no-comm rule applies during game)
- Sound effects
- Illustrated card assets
- Mobile board layout strategy (scroll vs. 2-row) — decide during implementation
- Rate limiting / abuse prevention on WebSocket server
