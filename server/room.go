package main

import (
	"crypto/rand"
	"fmt"
	"log/slog"
	"math/big"
	"strings"
	"sync"
)

const (
	roomCodeLength = 4
	// Ambiguous characters excluded: 0/O, 1/I/L
	roomCodeChars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
)

// Room represents a game room with up to two players.
type Room struct {
	Code           string
	Players        [2]*Client
	Game           *Game
	PlayAgainReady [2]bool // tracks which players want a rematch
	mu             sync.Mutex
}

// AddPlayer adds a client to the room. Returns the assigned player number (1 or 2).
func (r *Room) AddPlayer(c *Client) (int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.Players[0] == nil {
		r.Players[0] = c
		return 1, nil
	}
	if r.Players[1] == nil {
		r.Players[1] = c
		return 2, nil
	}
	return 0, fmt.Errorf("room %s is full", r.Code)
}

// RemovePlayer removes a client from the room. Returns true if the room is now empty.
func (r *Room) RemovePlayer(c *Client) bool {
	r.mu.Lock()
	defer r.mu.Unlock()

	for i, p := range r.Players {
		if p == c {
			r.Players[i] = nil
			break
		}
	}
	return r.Players[0] == nil && r.Players[1] == nil
}

// Partner returns the other player in the room, or nil.
func (r *Room) Partner(c *Client) *Client {
	r.mu.Lock()
	defer r.mu.Unlock()

	for _, p := range r.Players {
		if p != nil && p != c {
			return p
		}
	}
	return nil
}

// StartGame creates and initializes a new game for the room.
func (r *Room) StartGame() (*Game, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.Game != nil {
		return nil, fmt.Errorf("room %s: game already started", r.Code)
	}
	if r.Players[0] == nil || r.Players[1] == nil {
		return nil, fmt.Errorf("room %s: both players required to start", r.Code)
	}
	game, err := NewGame()
	if err != nil {
		return nil, err
	}
	r.Game = game
	return game, nil
}

// GamePhase returns the current game phase, or PhaseLobby if no game exists.
func (r *Room) GamePhase() Phase {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.Game == nil {
		return PhaseLobby
	}
	return r.Game.Phase
}

// ResetGame creates a new game for a rematch, clearing play-again state.
func (r *Room) ResetGame() (*Game, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.Players[0] == nil || r.Players[1] == nil {
		return nil, fmt.Errorf("room %s: both players required for rematch", r.Code)
	}
	game, err := NewGame()
	if err != nil {
		return nil, err
	}
	r.Game = game
	r.PlayAgainReady = [2]bool{}
	return game, nil
}

// RoomManager manages active game rooms.
type RoomManager struct {
	rooms map[string]*Room
	mu    sync.RWMutex
}

// NewRoomManager creates a new RoomManager.
func NewRoomManager() *RoomManager {
	return &RoomManager{
		rooms: make(map[string]*Room),
	}
}

// CreateRoom creates a new room with a unique code.
func (rm *RoomManager) CreateRoom() (*Room, error) {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	for attempts := 0; attempts < 100; attempts++ {
		code, err := generateRoomCode()
		if err != nil {
			return nil, fmt.Errorf("generating room code: %w", err)
		}
		if _, exists := rm.rooms[code]; !exists {
			room := &Room{Code: code}
			rm.rooms[code] = room
			slog.Info("room created", "code", code)
			return room, nil
		}
	}
	return nil, fmt.Errorf("failed to generate unique room code after 100 attempts")
}

// GetRoom retrieves a room by its code (case-insensitive).
func (rm *RoomManager) GetRoom(code string) *Room {
	rm.mu.RLock()
	defer rm.mu.RUnlock()
	return rm.rooms[strings.ToUpper(code)]
}

// RemoveRoom removes a room by its code.
func (rm *RoomManager) RemoveRoom(code string) {
	rm.mu.Lock()
	defer rm.mu.Unlock()
	delete(rm.rooms, code)
	slog.Info("room removed", "code", code)
}

func generateRoomCode() (string, error) {
	code := make([]byte, roomCodeLength)
	for i := range code {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(roomCodeChars))))
		if err != nil {
			return "", err
		}
		code[i] = roomCodeChars[n.Int64()]
	}
	return string(code), nil
}
