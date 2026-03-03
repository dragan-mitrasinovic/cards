package main

import (
	"crypto/rand"
	"fmt"
	"log/slog"
	"math/big"
	"sync"
	"time"
)

const (
	roomCodeLength = 4
	// Ambiguous characters excluded: 0/O, 1/I/L
	roomCodeChars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

	// gracePeriod is how long a room stays alive after a player disconnects.
	gracePeriod = 30 * time.Second
)

// DisconnectedPlayer holds info about a player who disconnected but may reconnect.
type DisconnectedPlayer struct {
	Name         string
	PlayerNumber int
}

// Room represents a game room with up to two players.
type Room struct {
	Code           string
	Players        [2]*Client
	Game           *Game
	PlayAgainReady [2]bool // tracks which players want a rematch
	mu             sync.Mutex

	// Disconnection tracking
	Disconnected [2]*DisconnectedPlayer // info about disconnected players
	graceTimers  [2]*time.Timer         // cleanup timers per player slot
}

// AddPlayer adds a client to the room. Returns the assigned player number (1 or 2).
// Rejects duplicate names atomically within the same lock.
func (r *Room) AddPlayer(c *Client, name string) (int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	// Check for duplicate name
	for _, p := range r.Players {
		if p != nil && p.name == name {
			return 0, fmt.Errorf("name already taken in this room")
		}
	}

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

// RemovePlayer removes a client from the room permanently.
func (r *Room) RemovePlayer(c *Client) {
	r.mu.Lock()
	defer r.mu.Unlock()

	for i, p := range r.Players {
		if p == c {
			r.Players[i] = nil
			r.Disconnected[i] = nil

			if r.graceTimers[i] != nil {
				r.graceTimers[i].Stop()
				r.graceTimers[i] = nil
			}

			break
		}
	}
}

// ExitPlayer removes a player who intentionally left the game.
// Unlike DisconnectPlayer, there is no grace period — the player is removed immediately
// and the game is reset so the remaining player can wait for a new partner.
func (r *Room) ExitPlayer(c *Client, rm *RoomManager) {
	r.mu.Lock()
	defer r.mu.Unlock()

	for i, p := range r.Players {
		if p == c {
			r.Players[i] = nil
			r.Disconnected[i] = nil

			if r.graceTimers[i] != nil {
				r.graceTimers[i].Stop()
				r.graceTimers[i] = nil
			}

			break
		}
	}

	// Reset game so room can accept a new partner
	r.Game = nil
	r.PlayAgainReady = [2]bool{}

	// Clean up any disconnected partner (no point reconnecting to a dead game)
	for i := range r.Disconnected {
		if r.Disconnected[i] != nil {
			r.Disconnected[i] = nil

			if r.graceTimers[i] != nil {
				r.graceTimers[i].Stop()
				r.graceTimers[i] = nil
			}
		}
	}

	// If room is completely empty, remove it
	if r.Players[0] == nil && r.Players[1] == nil {
		go rm.RemoveRoom(r.Code)
	}
}

// DisconnectPlayer marks a player as disconnected and starts a grace timer.
// Returns the player's slot index, or -1 if not found.
func (r *Room) DisconnectPlayer(c *Client, rm *RoomManager) int {
	r.mu.Lock()
	defer r.mu.Unlock()

	idx := -1
	for i, p := range r.Players {
		if p == c {
			idx = i
			break
		}
	}

	if idx == -1 {
		return -1
	}

	r.Disconnected[idx] = &DisconnectedPlayer{
		Name:         c.name,
		PlayerNumber: c.playerNumber,
	}
	r.Players[idx] = nil

	// Start grace timer — permanently remove after timeout
	r.graceTimers[idx] = time.AfterFunc(gracePeriod, func() {
		r.mu.Lock()
		r.Disconnected[idx] = nil
		r.graceTimers[idx] = nil
		empty := r.Players[0] == nil && r.Players[1] == nil &&
			r.Disconnected[0] == nil && r.Disconnected[1] == nil
		r.mu.Unlock()

		if empty {
			rm.RemoveRoom(r.Code)
		}

		slog.Info("grace period expired", "room", r.Code, "slot", idx+1)
	})

	return idx
}

// ReconnectPlayer restores a disconnected player into the room.
// Returns the player number and true if successful, or 0 and false if not found.
func (r *Room) ReconnectPlayer(c *Client, name string) (int, bool) {
	r.mu.Lock()
	defer r.mu.Unlock()

	for i, d := range r.Disconnected {
		if d != nil && d.Name == name {
			c.name = d.Name
			c.playerNumber = d.PlayerNumber
			c.room = r
			r.Players[i] = c
			r.Disconnected[i] = nil

			if r.graceTimers[i] != nil {
				r.graceTimers[i].Stop()
				r.graceTimers[i] = nil
			}

			return d.PlayerNumber, true
		}
	}

	return 0, false
}

// IsEmpty reports whether the room has no players and no disconnected players.
func (r *Room) IsEmpty() bool {
	r.mu.Lock()
	defer r.mu.Unlock()

	return r.Players[0] == nil && r.Players[1] == nil &&
		r.Disconnected[0] == nil && r.Disconnected[1] == nil
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

// GetRoom retrieves a room by its code.
func (rm *RoomManager) GetRoom(code string) *Room {
	rm.mu.RLock()
	defer rm.mu.RUnlock()

	return rm.rooms[code]
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
