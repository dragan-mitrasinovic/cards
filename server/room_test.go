package main

import (
	"testing"
)

func TestGenerateRoomCode(t *testing.T) {
	code, err := generateRoomCode()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(code) != roomCodeLength {
		t.Errorf("expected code length %d, got %d", roomCodeLength, len(code))
	}

	for _, ch := range code {
		if !contains(roomCodeChars, byte(ch)) {
			t.Errorf("code contains invalid character: %c", ch)
		}
	}
}

func TestGenerateRoomCodeUniqueness(t *testing.T) {
	seen := make(map[string]bool)

	for i := 0; i < 100; i++ {
		code, err := generateRoomCode()
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		seen[code] = true
	}

	if len(seen) < 90 {
		t.Errorf("expected at least 90 unique codes out of 100, got %d", len(seen))
	}
}

func TestRoomManagerCreateAndGet(t *testing.T) {
	rm := NewRoomManager()

	room, err := rm.CreateRoom()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if room.Code == "" {
		t.Fatal("expected non-empty room code")
	}

	got := rm.GetRoom(room.Code)
	if got != room {
		t.Error("expected to find the created room")
	}
}

func TestRoomManagerGetNotFound(t *testing.T) {
	rm := NewRoomManager()
	got := rm.GetRoom("ZZZZ")

	if got != nil {
		t.Error("expected nil for non-existent room")
	}
}

func TestRoomManagerRemoveRoom(t *testing.T) {
	rm := NewRoomManager()
	room, err := rm.CreateRoom()

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	rm.RemoveRoom(room.Code)

	got := rm.GetRoom(room.Code)
	if got != nil {
		t.Error("expected nil after removing room")
	}
}

func TestRoomAddPlayer(t *testing.T) {
	room := &Room{Code: "TEST"}
	c1 := &Client{name: "Alice"}
	c2 := &Client{name: "Bob"}
	c3 := &Client{name: "Charlie"}

	num, err := room.AddPlayer(c1)
	if err != nil {
		t.Fatalf("unexpected error adding player 1: %v", err)
	}
	if num != 1 {
		t.Errorf("expected player number 1, got %d", num)
	}

	num, err = room.AddPlayer(c2)
	if err != nil {
		t.Fatalf("unexpected error adding player 2: %v", err)
	}
	if num != 2 {
		t.Errorf("expected player number 2, got %d", num)
	}

	_, err = room.AddPlayer(c3)
	if err == nil {
		t.Error("expected error when adding third player to full room")
	}
}

func TestRoomRemovePlayer(t *testing.T) {
	room := &Room{Code: "TEST"}
	c1 := &Client{name: "Alice"}
	c2 := &Client{name: "Bob"}

	room.AddPlayer(c1)
	room.AddPlayer(c2)

	room.RemovePlayer(c1)
	if room.IsEmpty() {
		t.Error("room should not be empty after removing one of two players")
	}

	room.RemovePlayer(c2)
	if !room.IsEmpty() {
		t.Error("room should be empty after removing both players")
	}
}

func TestRoomPartner(t *testing.T) {
	room := &Room{Code: "TEST"}
	c1 := &Client{name: "Alice"}
	c2 := &Client{name: "Bob"}

	room.AddPlayer(c1)

	opp := room.Partner(c1)
	if opp != nil {
		t.Error("expected no partner when only one player")
	}

	room.AddPlayer(c2)

	opp = room.Partner(c1)
	if opp != c2 {
		t.Error("expected c2 as partner of c1")
	}

	opp = room.Partner(c2)
	if opp != c1 {
		t.Error("expected c1 as partner of c2")
	}
}

func contains(s string, ch byte) bool {
	for i := range len(s) {
		if s[i] == ch {
			return true
		}
	}
	return false
}
