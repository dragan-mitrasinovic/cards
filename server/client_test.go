package main

import (
	"testing"
)

func TestValidateName(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		want    string
		wantErr bool
	}{
		{"valid name", "Alice", "Alice", false},
		{"trims whitespace", "  Bob  ", "Bob", false},
		{"empty name", "", "", true},
		{"whitespace only", "   ", "", true},
		{"max length", "12345678901234567890", "12345678901234567890", false},
		{"too long", "123456789012345678901", "", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := validateName(tt.input)

			if (err != nil) != tt.wantErr {
				t.Errorf("validateName(%q) error = %v, wantErr %v", tt.input, err, tt.wantErr)
				return
			}

			if got != tt.want {
				t.Errorf("validateName(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}
