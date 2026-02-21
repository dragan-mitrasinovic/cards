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
