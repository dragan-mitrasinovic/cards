package main

// Envelope is used to determine the message type before full deserialization.
type Envelope struct {
	Type string `json:"type"`
}

// --- Client → Server ---

// CreateRoomMsg requests creation of a new game room.
type CreateRoomMsg struct {
	Type string `json:"type"`
	Name string `json:"name"`
}

// JoinRoomMsg requests joining an existing room.
type JoinRoomMsg struct {
	Type     string `json:"type"`
	Name     string `json:"name"`
	RoomCode string `json:"roomCode"`
}

// --- Server → Client ---

// RoomCreatedMsg is sent to the player who created a room.
type RoomCreatedMsg struct {
	Type         string `json:"type"`
	RoomCode     string `json:"roomCode"`
	PlayerNumber int    `json:"playerNumber"`
}

// PlayerJoinedMsg is sent to both players when the second player joins.
type PlayerJoinedMsg struct {
	Type         string `json:"type"`
	PlayerName   string `json:"playerName"`
	PlayerNumber int    `json:"playerNumber"`
	PartnerName string `json:"partnerName"`
}

// PlayerDisconnectedMsg is sent to the remaining player when the other disconnects.
type PlayerDisconnectedMsg struct {
	Type       string `json:"type"`
	PlayerName string `json:"playerName"`
}

// ErrorResponseMsg is sent to a client when an error occurs.
type ErrorResponseMsg struct {
	Type    string `json:"type"`
	Message string `json:"message"`
}

// newError creates a new error response message.
func newError(message string) ErrorResponseMsg {
	return ErrorResponseMsg{Type: "error", Message: message}
}

// --- Game messages ---

// TurnOrderPromptMsg asks a player to pick their turn order preference.
type TurnOrderPromptMsg struct {
	Type string `json:"type"`
}

// TurnOrderPickMsg is sent by a player to indicate their turn order preference.
type TurnOrderPickMsg struct {
	Type       string `json:"type"`
	Preference string `json:"preference"`
}

// TurnOrderResultMsg is sent to both players after both have picked.
type TurnOrderResultMsg struct {
	Type        string `json:"type"`
	Pick1       string `json:"pick1"`
	Pick2       string `json:"pick2"`
	Conflict    bool   `json:"conflict"`
	FirstPlayer int    `json:"firstPlayer,omitempty"`
}

// YourTurnMsg is sent to the active player to prompt them for their turn.
type YourTurnMsg struct {
	Type string `json:"type"`
}

// GameStartMsg is sent to each player when the game begins, containing their hand.
type GameStartMsg struct {
	Type        string `json:"type"`
	Hand        []Card `json:"hand"`
	FirstPlayer int    `json:"firstPlayer"`
}

// --- Placement phase messages ---

// PlaceCardMsg is sent by a player to place a card on the board.
type PlaceCardMsg struct {
	Type      string `json:"type"`
	CardIndex int    `json:"cardIndex"`
	SlotIndex int    `json:"slotIndex"`
}

// PassMsg is sent by a player to use their single pass.
type PassMsg struct {
	Type string `json:"type"`
}

// PeekMsg is sent by a player to peek at one of their placed cards.
type PeekMsg struct {
	Type      string `json:"type"`
	SlotIndex int    `json:"slotIndex"`
}

// CardPlacedMsg notifies both players that a card was placed (face-down).
type CardPlacedMsg struct {
	Type      string `json:"type"`
	SlotIndex int    `json:"slotIndex"`
	ByPlayer  int    `json:"byPlayer"`
}

// PlayerPassedMsg notifies both players that a player used their pass.
type PlayerPassedMsg struct {
	Type     string `json:"type"`
	ByPlayer int    `json:"byPlayer"`
}

// PeekResultMsg is sent to the requesting player with the card value.
type PeekResultMsg struct {
	Type      string `json:"type"`
	SlotIndex int    `json:"slotIndex"`
	Card      Card   `json:"card"`
}

// SwapPromptMsg notifies a player that it is their turn to suggest a swap.
type SwapPromptMsg struct {
	Type     string `json:"type"`
	ByPlayer int    `json:"byPlayer"`
}

// --- Swap phase messages (Client → Server) ---

// SuggestSwapMsg is sent by a player to suggest swapping two adjacent cards.
type SuggestSwapMsg struct {
	Type  string `json:"type"`
	SlotA int    `json:"slotA"`
	SlotB int    `json:"slotB"`
}

// SkipSwapMsg is sent by a player to skip their swap opportunity.
type SkipSwapMsg struct {
	Type string `json:"type"`
}

// RespondSwapMsg is sent by a player to accept or reject a swap suggestion.
type RespondSwapMsg struct {
	Type   string `json:"type"`
	Accept bool   `json:"accept"`
}

// --- Swap phase messages (Server → Client) ---

// SwapSuggestedMsg notifies both players that a swap has been suggested.
type SwapSuggestedMsg struct {
	Type     string `json:"type"`
	SlotA    int    `json:"slotA"`
	SlotB    int    `json:"slotB"`
	ByPlayer int    `json:"byPlayer"`
}

// SwapResultMsg notifies both players of the swap outcome.
type SwapResultMsg struct {
	Type     string `json:"type"`
	Accepted bool   `json:"accepted"`
	SlotA    int    `json:"slotA,omitempty"`
	SlotB    int    `json:"slotB,omitempty"`
}

// --- Reveal phase messages (Server → Client) ---

// RevealCardMsg notifies both players of a card being revealed.
type RevealCardMsg struct {
	Type      string `json:"type"`
	SlotIndex int    `json:"slotIndex"`
	Card      Card   `json:"card"`
	Delay     int    `json:"delay"` // cumulative ms from reveal start
}

// BoardCard represents a card on the board for the game result.
type BoardCard struct {
	SlotIndex int  `json:"slotIndex"`
	Card      Card `json:"card"`
}

// GameResultMsg notifies both players of the final game result.
type GameResultMsg struct {
	Type  string      `json:"type"`
	Win   bool        `json:"win"`
	Board []BoardCard `json:"board"`
}
