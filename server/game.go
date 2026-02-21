package main

import (
	"crypto/rand"
	"fmt"
	"math/big"
)

// Suit represents a card suit.
type Suit string

const (
	Hearts   Suit = "H"
	Spades   Suit = "S"
	Diamonds Suit = "D"
	Clubs    Suit = "C"
)

// suitOrder defines the global sort order for suits.
var suitOrder = map[Suit]int{
	Hearts:   0,
	Spades:   1,
	Diamonds: 2,
	Clubs:    3,
}

// Card represents a single playing card.
type Card struct {
	Suit  Suit `json:"suit"`
	Value int  `json:"value"`
}

// SortIndex returns the global sort position of a card (0–39).
func (c Card) SortIndex() int {
	return suitOrder[c.Suit]*10 + (c.Value - 1)
}

// NewDeck creates a standard 40-card deck (4 suits × 10 values).
func NewDeck() []Card {
	suits := []Suit{Hearts, Spades, Diamonds, Clubs}
	deck := make([]Card, 0, 40)
	for _, s := range suits {
		for v := 1; v <= 10; v++ {
			deck = append(deck, Card{Suit: s, Value: v})
		}
	}
	return deck
}

// ShuffleDeck shuffles a deck in place using crypto/rand.
func ShuffleDeck(deck []Card) error {
	for i := len(deck) - 1; i > 0; i-- {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(i+1)))
		if err != nil {
			return fmt.Errorf("shuffling deck: %w", err)
		}
		j := int(n.Int64())
		deck[i], deck[j] = deck[j], deck[i]
	}
	return nil
}

// Deal shuffles the deck and returns two hands of 7 cards each.
func Deal() ([7]Card, [7]Card, error) {
	deck := NewDeck()
	if err := ShuffleDeck(deck); err != nil {
		return [7]Card{}, [7]Card{}, err
	}
	var hand1, hand2 [7]Card
	copy(hand1[:], deck[0:7])
	copy(hand2[:], deck[7:14])
	return hand1, hand2, nil
}

// Phase represents the current phase of the game.
type Phase string

const (
	PhaseLobby         Phase = "lobby"
	PhaseTurnOrderPick Phase = "turn_order_pick"
	PhasePlacement     Phase = "placement"
	PhaseSwap          Phase = "swap"
	PhaseReveal        Phase = "reveal"
	PhaseGameOver      Phase = "game_over"
)

// BoardSize is the number of slots on the game board.
const BoardSize = 15

// Preference represents a player's turn order preference.
type Preference string

const (
	PrefFirst   Preference = "first"
	PrefNeutral Preference = "neutral"
	PrefNoFirst Preference = "no_first"
)

// ValidPreference reports whether p is a valid turn order preference.
func ValidPreference(p string) bool {
	switch Preference(p) {
	case PrefFirst, PrefNeutral, PrefNoFirst:
		return true
	}
	return false
}

// Game represents the state of a single game.
type Game struct {
	Phase       Phase
	Hands       [2][7]Card
	Board       [BoardSize]*Card
	FirstPlayer int // 1 or 2; set after turn order resolution
	CurrentTurn int // 1 or 2
	PassUsed    [2]bool
	Picks       [2]Preference // turn order preferences (index 0 = player 1)
}

// SetPick records a player's turn order preference. playerNumber is 1 or 2.
func (g *Game) SetPick(playerNumber int, pref Preference) {
	g.Picks[playerNumber-1] = pref
}

// BothPicked reports whether both players have submitted their turn order preference.
func (g *Game) BothPicked() bool {
	return g.Picks[0] != "" && g.Picks[1] != ""
}

// ResolveTurnOrder resolves the turn order picks. Returns (firstPlayer, conflict).
// If conflict is true, firstPlayer is 0 and picks should be reset for re-pick.
func (g *Game) ResolveTurnOrder() (int, bool) {
	p1, p2 := g.Picks[0], g.Picks[1]

	switch {
	case p1 == PrefFirst && p2 == PrefFirst:
		return 0, true
	case p1 == PrefNoFirst && p2 == PrefNoFirst:
		return 0, true
	case p1 == PrefFirst && p2 != PrefFirst:
		return 1, false
	case p2 == PrefFirst && p1 != PrefFirst:
		return 2, false
	case p1 == PrefNoFirst && p2 != PrefNoFirst:
		return 2, false
	case p2 == PrefNoFirst && p1 != PrefNoFirst:
		return 1, false
	default:
		// Both neutral — random pick
		n, err := rand.Int(rand.Reader, big.NewInt(2))
		if err != nil {
			return 1, false // fallback
		}
		return int(n.Int64()) + 1, false
	}
}

// ResetPicks clears both players' turn order preferences for a re-pick.
func (g *Game) ResetPicks() {
	g.Picks = [2]Preference{}
}

// NewGame creates a new game, shuffles and deals cards.
func NewGame() (*Game, error) {
	hand1, hand2, err := Deal()
	if err != nil {
		return nil, fmt.Errorf("creating game: %w", err)
	}
	return &Game{
		Phase: PhaseTurnOrderPick,
		Hands: [2][7]Card{hand1, hand2},
	}, nil
}
