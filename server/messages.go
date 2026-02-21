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
