package main

import (
	"fmt"
	"testing"
)

func TestNewDeck(t *testing.T) {
	deck := NewDeck()

	t.Run("has 40 cards", func(t *testing.T) {
		if len(deck) != 40 {
			t.Errorf("expected 40 cards, got %d", len(deck))
		}
	})

	t.Run("all cards unique", func(t *testing.T) {
		seen := make(map[Card]bool)
		for _, c := range deck {
			if seen[c] {
				t.Errorf("duplicate card: %v", c)
			}
			seen[c] = true
		}
	})

	t.Run("correct suits and values", func(t *testing.T) {
		suits := map[Suit]int{}
		for _, c := range deck {
			if c.Value < 1 || c.Value > 10 {
				t.Errorf("invalid value: %d", c.Value)
			}
			suits[c.Suit]++
		}
		for _, s := range []Suit{Hearts, Spades, Diamonds, Clubs} {
			if suits[s] != 10 {
				t.Errorf("expected 10 cards for suit %s, got %d", s, suits[s])
			}
		}
	})
}

func TestSortIndex(t *testing.T) {
	tests := []struct {
		card  Card
		index int
	}{
		{Card{Hearts, 1}, 0},
		{Card{Hearts, 10}, 9},
		{Card{Spades, 1}, 10},
		{Card{Spades, 10}, 19},
		{Card{Diamonds, 1}, 20},
		{Card{Diamonds, 5}, 24},
		{Card{Clubs, 1}, 30},
		{Card{Clubs, 10}, 39},
	}
	for _, tt := range tests {
		t.Run(fmt.Sprintf("%s%d", tt.card.Suit, tt.card.Value), func(t *testing.T) {
			if got := tt.card.SortIndex(); got != tt.index {
				t.Errorf("SortIndex() = %d, want %d", got, tt.index)
			}
		})
	}
}

func TestSortOrderIsMonotonic(t *testing.T) {
	deck := NewDeck()
	for i := 1; i < len(deck); i++ {
		if deck[i].SortIndex() <= deck[i-1].SortIndex() {
			t.Errorf("sort order not monotonic at index %d: %v (%d) <= %v (%d)",
				i, deck[i], deck[i].SortIndex(), deck[i-1], deck[i-1].SortIndex())
		}
	}
}

func TestShuffleDeck(t *testing.T) {
	deck1 := NewDeck()
	deck2 := NewDeck()
	if err := ShuffleDeck(deck2); err != nil {
		t.Fatalf("ShuffleDeck error: %v", err)
	}

	same := true
	for i := range deck1 {
		if deck1[i] != deck2[i] {
			same = false
			break
		}
	}
	if same {
		t.Error("shuffled deck is identical to unshuffled deck (extremely unlikely)")
	}

	// Verify all cards still present after shuffle
	seen := make(map[Card]bool)
	for _, c := range deck2 {
		seen[c] = true
	}
	if len(seen) != 40 {
		t.Errorf("expected 40 unique cards after shuffle, got %d", len(seen))
	}
}

func TestDeal(t *testing.T) {
	hand1, hand2, err := Deal()
	if err != nil {
		t.Fatalf("Deal error: %v", err)
	}

	t.Run("each hand has 7 cards", func(t *testing.T) {
		if len(hand1) != 7 {
			t.Errorf("hand1: expected 7 cards, got %d", len(hand1))
		}
		if len(hand2) != 7 {
			t.Errorf("hand2: expected 7 cards, got %d", len(hand2))
		}
	})

	t.Run("no overlap between hands", func(t *testing.T) {
		seen := make(map[Card]bool)
		for _, c := range hand1 {
			seen[c] = true
		}
		for _, c := range hand2 {
			if seen[c] {
				t.Errorf("card %v appears in both hands", c)
			}
		}
	})

	t.Run("all cards are valid", func(t *testing.T) {
		for _, hand := range [][7]Card{hand1, hand2} {
			for _, c := range hand {
				if c.Suit == "" || c.Value < 1 || c.Value > 10 {
					t.Errorf("invalid card: %v", c)
				}
			}
		}
	})
}

func TestNewGame(t *testing.T) {
	game, err := NewGame()
	if err != nil {
		t.Fatalf("NewGame error: %v", err)
	}

	if game.Phase != PhaseTurnOrderPick {
		t.Errorf("expected phase %s, got %s", PhaseTurnOrderPick, game.Phase)
	}

	// Verify hands are dealt with valid cards
	for i, hand := range game.Hands {
		for j, card := range hand {
			if card.Suit == "" || card.Value == 0 {
				t.Errorf("hand[%d][%d] has zero-value card: %v", i, j, card)
			}
		}
	}

	// Verify no overlap between hands
	seen := make(map[Card]bool)
	for _, c := range game.Hands[0] {
		seen[c] = true
	}
	for _, c := range game.Hands[1] {
		if seen[c] {
			t.Errorf("card %v appears in both hands", c)
		}
	}

	// Board should be empty
	for i, slot := range game.Board {
		if slot != nil {
			t.Errorf("board slot %d should be nil, got %v", i, slot)
		}
	}
}

func TestValidPreference(t *testing.T) {
	tests := []struct {
		input string
		valid bool
	}{
		{"first", true},
		{"neutral", true},
		{"no_first", true},
		{"", false},
		{"invalid", false},
		{"FIRST", false},
	}
	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			if got := ValidPreference(tt.input); got != tt.valid {
				t.Errorf("ValidPreference(%q) = %v, want %v", tt.input, got, tt.valid)
			}
		})
	}
}

func TestResolveTurnOrder(t *testing.T) {
	tests := []struct {
		name        string
		pick1       Preference
		pick2       Preference
		wantFirst   int
		wantConflct bool
	}{
		{"both first = conflict", PrefFirst, PrefFirst, 0, true},
		{"both no_first = conflict", PrefNoFirst, PrefNoFirst, 0, true},
		{"first vs neutral", PrefFirst, PrefNeutral, 1, false},
		{"first vs no_first", PrefFirst, PrefNoFirst, 1, false},
		{"neutral vs first", PrefNeutral, PrefFirst, 2, false},
		{"no_first vs first", PrefNoFirst, PrefFirst, 2, false},
		{"no_first vs neutral", PrefNoFirst, PrefNeutral, 2, false},
		{"neutral vs no_first", PrefNeutral, PrefNoFirst, 1, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			game := &Game{Picks: [2]Preference{tt.pick1, tt.pick2}}
			first, conflict := game.ResolveTurnOrder()
			if conflict != tt.wantConflct {
				t.Errorf("conflict = %v, want %v", conflict, tt.wantConflct)
			}
			if !tt.wantConflct && first != tt.wantFirst {
				t.Errorf("firstPlayer = %d, want %d", first, tt.wantFirst)
			}
		})
	}
}

func TestResolveTurnOrderBothNeutral(t *testing.T) {
	// Both neutral should randomly pick 1 or 2 without conflict
	game := &Game{Picks: [2]Preference{PrefNeutral, PrefNeutral}}
	first, conflict := game.ResolveTurnOrder()
	if conflict {
		t.Error("both neutral should not be a conflict")
	}
	if first != 1 && first != 2 {
		t.Errorf("firstPlayer should be 1 or 2, got %d", first)
	}
}

func TestSetPickAndBothPicked(t *testing.T) {
	game := &Game{}

	if game.BothPicked() {
		t.Error("BothPicked should be false before any picks")
	}

	game.SetPick(1, PrefFirst)
	if game.BothPicked() {
		t.Error("BothPicked should be false with only one pick")
	}

	game.SetPick(2, PrefNeutral)
	if !game.BothPicked() {
		t.Error("BothPicked should be true after both picks")
	}
}

func TestResetPicks(t *testing.T) {
	game := &Game{Picks: [2]Preference{PrefFirst, PrefNoFirst}}
	game.ResetPicks()
	if game.Picks[0] != "" || game.Picks[1] != "" {
		t.Error("ResetPicks should clear both picks")
	}
}

func newTestGame() *Game {
	return &Game{
		Phase:       PhasePlacement,
		Hands:       [2][7]Card{
			{Card{Hearts, 1}, Card{Hearts, 2}, Card{Hearts, 3}, Card{Hearts, 4}, Card{Hearts, 5}, Card{Hearts, 6}, Card{Hearts, 7}},
			{Card{Spades, 1}, Card{Spades, 2}, Card{Spades, 3}, Card{Spades, 4}, Card{Spades, 5}, Card{Spades, 6}, Card{Spades, 7}},
		},
		FirstPlayer: 1,
		CurrentTurn: 1,
	}
}

func TestPlaceCard(t *testing.T) {
	t.Run("valid placement", func(t *testing.T) {
		g := newTestGame()
		if err := g.PlaceCard(1, 0, 0); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if g.Board[0] == nil {
			t.Fatal("expected card at slot 0")
		}
		if g.Board[0].Suit != Hearts || g.Board[0].Value != 1 {
			t.Errorf("expected H1, got %v", *g.Board[0])
		}
		if g.BoardOwner[0] != 1 {
			t.Errorf("expected owner 1, got %d", g.BoardOwner[0])
		}
		if g.CardsPlaced[0] != 1 {
			t.Errorf("expected 1 card placed, got %d", g.CardsPlaced[0])
		}
		if !g.HandUsed[0][0] {
			t.Error("expected hand card 0 to be used")
		}
		if g.CurrentTurn != 2 {
			t.Errorf("expected turn to advance to 2, got %d", g.CurrentTurn)
		}
	})

	t.Run("wrong turn", func(t *testing.T) {
		g := newTestGame()
		if err := g.PlaceCard(2, 0, 0); err == nil {
			t.Error("expected error for wrong turn")
		}
	})

	t.Run("invalid card index", func(t *testing.T) {
		g := newTestGame()
		if err := g.PlaceCard(1, 7, 0); err == nil {
			t.Error("expected error for invalid card index")
		}
		if err := g.PlaceCard(1, -1, 0); err == nil {
			t.Error("expected error for negative card index")
		}
	})

	t.Run("card already placed", func(t *testing.T) {
		g := newTestGame()
		g.PlaceCard(1, 0, 0)
		g.PlaceCard(2, 0, 1)
		if err := g.PlaceCard(1, 0, 2); err == nil {
			t.Error("expected error for already placed card")
		}
	})

	t.Run("invalid slot index", func(t *testing.T) {
		g := newTestGame()
		if err := g.PlaceCard(1, 0, 15); err == nil {
			t.Error("expected error for invalid slot")
		}
		if err := g.PlaceCard(1, 0, -1); err == nil {
			t.Error("expected error for negative slot")
		}
	})

	t.Run("slot occupied", func(t *testing.T) {
		g := newTestGame()
		g.PlaceCard(1, 0, 5)
		g.PlaceCard(2, 0, 6)
		if err := g.PlaceCard(1, 1, 5); err == nil {
			t.Error("expected error for occupied slot")
		}
	})

	t.Run("wrong phase", func(t *testing.T) {
		g := newTestGame()
		g.Phase = PhaseTurnOrderPick
		if err := g.PlaceCard(1, 0, 0); err == nil {
			t.Error("expected error for wrong phase")
		}
	})
}

func TestPlaceCardTransitionsToSwap(t *testing.T) {
	g := newTestGame()
	// Place all 14 cards alternating turns
	for i := 0; i < 7; i++ {
		if err := g.PlaceCard(1, i, i*2); err != nil {
			t.Fatalf("player 1 place card %d: %v", i, err)
		}
		if err := g.PlaceCard(2, i, i*2+1); err != nil {
			t.Fatalf("player 2 place card %d: %v", i, err)
		}
	}
	if g.Phase != PhaseSwap {
		t.Errorf("expected swap phase, got %s", g.Phase)
	}
	if g.CurrentTurn != g.FirstPlayer {
		t.Errorf("expected current turn to be first player (%d), got %d", g.FirstPlayer, g.CurrentTurn)
	}
}

func TestUsePass(t *testing.T) {
	t.Run("valid pass", func(t *testing.T) {
		g := newTestGame()
		if err := g.UsePass(1); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !g.PassUsed[0] {
			t.Error("expected pass to be used")
		}
		if g.CurrentTurn != 2 {
			t.Errorf("expected turn to advance to 2, got %d", g.CurrentTurn)
		}
	})

	t.Run("double pass", func(t *testing.T) {
		g := newTestGame()
		g.UsePass(1)
		g.PlaceCard(2, 0, 0)
		if err := g.UsePass(1); err == nil {
			t.Error("expected error for double pass")
		}
	})

	t.Run("wrong turn", func(t *testing.T) {
		g := newTestGame()
		if err := g.UsePass(2); err == nil {
			t.Error("expected error for wrong turn")
		}
	})

	t.Run("wrong phase", func(t *testing.T) {
		g := newTestGame()
		g.Phase = PhaseSwap
		if err := g.UsePass(1); err == nil {
			t.Error("expected error for wrong phase")
		}
	})
}

func TestPeek(t *testing.T) {
	t.Run("valid peek own card", func(t *testing.T) {
		g := newTestGame()
		g.PlaceCard(1, 0, 3)
		card, err := g.Peek(1, 3)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if card.Suit != Hearts || card.Value != 1 {
			t.Errorf("expected H1, got %v", *card)
		}
	})

	t.Run("peek other player card", func(t *testing.T) {
		g := newTestGame()
		g.PlaceCard(1, 0, 3)
		if _, err := g.Peek(2, 3); err == nil {
			t.Error("expected error for peeking other player's card")
		}
	})

	t.Run("peek empty slot", func(t *testing.T) {
		g := newTestGame()
		if _, err := g.Peek(1, 5); err == nil {
			t.Error("expected error for peeking empty slot")
		}
	})

	t.Run("invalid slot", func(t *testing.T) {
		g := newTestGame()
		if _, err := g.Peek(1, 15); err == nil {
			t.Error("expected error for invalid slot")
		}
	})

	t.Run("wrong phase", func(t *testing.T) {
		g := newTestGame()
		g.Phase = PhaseLobby
		if _, err := g.Peek(1, 0); err == nil {
			t.Error("expected error for wrong phase")
		}
	})
}

func TestAllCardsPlaced(t *testing.T) {
	g := newTestGame()
	if g.AllCardsPlaced() {
		t.Error("should not be all placed initially")
	}
	g.CardsPlaced = [2]int{7, 7}
	if !g.AllCardsPlaced() {
		t.Error("should be all placed with 7 each")
	}
}
