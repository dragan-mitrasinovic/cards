package main

import (
	"testing"
)

func TestAllowedEmotes(t *testing.T) {
	valid := []string{"Wow", "Well Played", "Interesting"}
	for _, emote := range valid {
		if !allowedEmotes[emote] {
			t.Errorf("expected %q to be allowed", emote)
		}
	}

	invalid := []string{"", "wow", "GG", "Hello", "well played", "INTERESTING"}
	for _, emote := range invalid {
		if allowedEmotes[emote] {
			t.Errorf("expected %q to be rejected", emote)
		}
	}
}
