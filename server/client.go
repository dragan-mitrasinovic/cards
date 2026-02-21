package main

import (
	"encoding/json"
	"log/slog"
	"strings"
	"time"

	"github.com/gorilla/websocket"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 4096
)

// Client represents a connected WebSocket player.
type Client struct {
	conn         *websocket.Conn
	rooms        *RoomManager
	room         *Room
	name         string
	playerNumber int
	send         chan []byte
}

// NewClient creates a new Client for a WebSocket connection.
func NewClient(conn *websocket.Conn, rooms *RoomManager) *Client {
	return &Client{
		conn:  conn,
		rooms: rooms,
		send:  make(chan []byte, 16),
	}
}

// SendMsg marshals a message and queues it for sending.
func (c *Client) SendMsg(msg any) {
	data, err := json.Marshal(msg)
	if err != nil {
		slog.Error("failed to marshal message", "error", err)
		return
	}
	select {
	case c.send <- data:
	default:
		slog.Warn("send buffer full, dropping message", "player", c.name)
	}
}

// ReadPump reads messages from the WebSocket and dispatches them.
func (c *Client) ReadPump() {
	defer func() {
		c.cleanup()
		c.conn.Close()
	}()

	c.conn.SetReadLimit(maxMessageSize)
	if err := c.conn.SetReadDeadline(time.Now().Add(pongWait)); err != nil {
		slog.Error("failed to set read deadline", "error", err)
		return
	}
	c.conn.SetPongHandler(func(string) error {
		return c.conn.SetReadDeadline(time.Now().Add(pongWait))
	})

	for {
		_, raw, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
				slog.Error("read error", "error", err)
			}
			break
		}
		c.handleMessage(raw)
	}
}

// WritePump pumps messages from the send channel to the WebSocket.
func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			if err := c.conn.SetWriteDeadline(time.Now().Add(writeWait)); err != nil {
				return
			}
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}
		case <-ticker.C:
			if err := c.conn.SetWriteDeadline(time.Now().Add(writeWait)); err != nil {
				return
			}
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (c *Client) handleMessage(raw []byte) {
	var env Envelope
	if err := json.Unmarshal(raw, &env); err != nil {
		c.SendMsg(newError("invalid message format"))
		return
	}

	switch env.Type {
	case "create_room":
		c.handleCreateRoom(raw)
	case "join_room":
		c.handleJoinRoom(raw)
	case "turn_order_pick":
		c.handleTurnOrderPick(raw)
	case "place_card":
		c.handlePlaceCard(raw)
	case "pass":
		c.handlePass()
	case "peek":
		c.handlePeek(raw)
	default:
		c.SendMsg(newError("unknown message type: " + env.Type))
	}
}

func (c *Client) handleCreateRoom(raw []byte) {
	var msg CreateRoomMsg
	if err := json.Unmarshal(raw, &msg); err != nil {
		c.SendMsg(newError("invalid create_room message"))
		return
	}

	name := strings.TrimSpace(msg.Name)
	if name == "" {
		c.SendMsg(newError("name is required"))
		return
	}
	if len(name) > 20 {
		c.SendMsg(newError("name too long"))
		return
	}

	if c.room != nil {
		c.SendMsg(newError("already in a room"))
		return
	}

	room, err := c.rooms.CreateRoom()
	if err != nil {
		c.SendMsg(newError("failed to create room"))
		slog.Error("failed to create room", "error", err)
		return
	}

	c.name = name
	c.room = room
	playerNum, err := room.AddPlayer(c)
	if err != nil {
		c.SendMsg(newError("failed to join room"))
		slog.Error("failed to add player to new room", "error", err)
		c.room = nil
		return
	}
	c.playerNumber = playerNum

	slog.Info("player created room", "player", c.name, "room", room.Code)

	c.SendMsg(RoomCreatedMsg{
		Type:         "room_created",
		RoomCode:     room.Code,
		PlayerNumber: c.playerNumber,
	})
}

func (c *Client) handleJoinRoom(raw []byte) {
	var msg JoinRoomMsg
	if err := json.Unmarshal(raw, &msg); err != nil {
		c.SendMsg(newError("invalid join_room message"))
		return
	}

	name := strings.TrimSpace(msg.Name)
	if name == "" {
		c.SendMsg(newError("name is required"))
		return
	}
	if len(name) > 20 {
		c.SendMsg(newError("name too long"))
		return
	}

	code := strings.ToUpper(strings.TrimSpace(msg.RoomCode))
	if code == "" {
		c.SendMsg(newError("room code is required"))
		return
	}

	if c.room != nil {
		c.SendMsg(newError("already in a room"))
		return
	}

	room := c.rooms.GetRoom(code)
	if room == nil {
		c.SendMsg(newError("room not found"))
		return
	}

	playerNum, err := room.AddPlayer(c)
	if err != nil {
		c.SendMsg(newError("room is full"))
		return
	}

	c.name = name
	c.room = room
	c.playerNumber = playerNum

	partner := room.Partner(c)
	partnerName := ""
	if partner != nil {
		partnerName = partner.name
	}

	slog.Info("player joined room", "player", c.name, "room", room.Code)

	c.SendMsg(PlayerJoinedMsg{
		Type:         "player_joined",
		PlayerName:   c.name,
		PlayerNumber: c.playerNumber,
		PartnerName:  partnerName,
	})

	if partner != nil {
		partner.SendMsg(PlayerJoinedMsg{
			Type:         "player_joined",
			PlayerName:   partner.name,
			PlayerNumber: partner.playerNumber,
			PartnerName:  c.name,
		})

		// Both players present — start the game
		game, err := room.StartGame()
		if err != nil {
			slog.Error("failed to start game", "error", err, "room", room.Code)
		} else {
			slog.Info("game started", "room", room.Code, "phase", game.Phase)
			c.SendMsg(TurnOrderPromptMsg{Type: "turn_order_prompt"})
			partner.SendMsg(TurnOrderPromptMsg{Type: "turn_order_prompt"})
		}
	}
}

func (c *Client) handleTurnOrderPick(raw []byte) {
	var msg TurnOrderPickMsg
	if err := json.Unmarshal(raw, &msg); err != nil {
		c.SendMsg(newError("invalid turn_order_pick message"))
		return
	}

	if c.room == nil {
		c.SendMsg(newError("no active game"))
		return
	}

	if c.room.GamePhase() != PhaseTurnOrderPick {
		c.SendMsg(newError("not in turn order pick phase"))
		return
	}

	if !ValidPreference(msg.Preference) {
		c.SendMsg(newError("invalid preference"))
		return
	}

	c.room.mu.Lock()
	game := c.room.Game

	// Prevent double-pick
	if game.Picks[c.playerNumber-1] != "" {
		c.room.mu.Unlock()
		c.SendMsg(newError("already picked"))
		return
	}

	game.SetPick(c.playerNumber, Preference(msg.Preference))
	slog.Info("turn order pick received", "player", c.name, "preference", msg.Preference, "room", c.room.Code)

	if !game.BothPicked() {
		c.room.mu.Unlock()
		return
	}

	// Both picked — resolve
	firstPlayer, conflict := game.ResolveTurnOrder()

	result := TurnOrderResultMsg{
		Type:     "turn_order_result",
		Pick1:    string(game.Picks[0]),
		Pick2:    string(game.Picks[1]),
		Conflict: conflict,
	}

	if conflict {
		game.ResetPicks()
		p1 := c.room.Players[0]
		p2 := c.room.Players[1]
		c.room.mu.Unlock()

		if p1 != nil {
			p1.SendMsg(result)
		}
		if p2 != nil {
			p2.SendMsg(result)
		}
		return
	}

	// Resolved — transition to placement phase
	game.FirstPlayer = firstPlayer
	game.CurrentTurn = firstPlayer
	game.Phase = PhasePlacement
	result.FirstPlayer = firstPlayer

	hand1 := game.Hands[0][:]
	hand2 := game.Hands[1][:]
	p1 := c.room.Players[0]
	p2 := c.room.Players[1]
	c.room.mu.Unlock()

	// Send result to both
	if p1 != nil {
		p1.SendMsg(result)
	}
	if p2 != nil {
		p2.SendMsg(result)
	}

	// Send game_start with each player's hand
	if p1 != nil {
		p1.SendMsg(GameStartMsg{Type: "game_start", Hand: hand1, FirstPlayer: firstPlayer})
	}
	if p2 != nil {
		p2.SendMsg(GameStartMsg{Type: "game_start", Hand: hand2, FirstPlayer: firstPlayer})
	}

	// Prompt the first player for their turn
	c.sendYourTurn(firstPlayer, p1, p2)
}

func (c *Client) handlePlaceCard(raw []byte) {
	var msg PlaceCardMsg
	if err := json.Unmarshal(raw, &msg); err != nil {
		c.SendMsg(newError("invalid place_card message"))
		return
	}

	if c.room == nil {
		c.SendMsg(newError("no active game"))
		return
	}

	c.room.mu.Lock()
	game := c.room.Game
	if game == nil {
		c.room.mu.Unlock()
		c.SendMsg(newError("no active game"))
		return
	}

	if err := game.PlaceCard(c.playerNumber, msg.CardIndex, msg.SlotIndex); err != nil {
		c.room.mu.Unlock()
		c.SendMsg(newError(err.Error()))
		return
	}

	phase := game.Phase
	currentTurn := game.CurrentTurn
	p1 := c.room.Players[0]
	p2 := c.room.Players[1]
	c.room.mu.Unlock()

	slog.Info("card placed", "player", c.name, "slot", msg.SlotIndex, "room", c.room.Code)

	placed := CardPlacedMsg{Type: "card_placed", SlotIndex: msg.SlotIndex, ByPlayer: c.playerNumber}
	if p1 != nil {
		p1.SendMsg(placed)
	}
	if p2 != nil {
		p2.SendMsg(placed)
	}

	if phase == PhaseSwap {
		// All cards placed — transition to swap phase
		prompt := SwapPromptMsg{Type: "swap_prompt", ByPlayer: currentTurn}
		if p1 != nil {
			p1.SendMsg(prompt)
		}
		if p2 != nil {
			p2.SendMsg(prompt)
		}
	} else {
		// Send your_turn to the next player
		c.sendYourTurn(currentTurn, p1, p2)
	}
}

func (c *Client) handlePass() {
	if c.room == nil {
		c.SendMsg(newError("no active game"))
		return
	}

	c.room.mu.Lock()
	game := c.room.Game
	if game == nil {
		c.room.mu.Unlock()
		c.SendMsg(newError("no active game"))
		return
	}

	if err := game.UsePass(c.playerNumber); err != nil {
		c.room.mu.Unlock()
		c.SendMsg(newError(err.Error()))
		return
	}

	currentTurn := game.CurrentTurn
	p1 := c.room.Players[0]
	p2 := c.room.Players[1]
	c.room.mu.Unlock()

	slog.Info("player passed", "player", c.name, "room", c.room.Code)

	passed := PlayerPassedMsg{Type: "player_passed", ByPlayer: c.playerNumber}
	if p1 != nil {
		p1.SendMsg(passed)
	}
	if p2 != nil {
		p2.SendMsg(passed)
	}

	c.sendYourTurn(currentTurn, p1, p2)
}

func (c *Client) handlePeek(raw []byte) {
	var msg PeekMsg
	if err := json.Unmarshal(raw, &msg); err != nil {
		c.SendMsg(newError("invalid peek message"))
		return
	}

	if c.room == nil {
		c.SendMsg(newError("no active game"))
		return
	}

	c.room.mu.Lock()
	game := c.room.Game
	if game == nil {
		c.room.mu.Unlock()
		c.SendMsg(newError("no active game"))
		return
	}

	card, err := game.Peek(c.playerNumber, msg.SlotIndex)
	c.room.mu.Unlock()

	if err != nil {
		c.SendMsg(newError(err.Error()))
		return
	}

	c.SendMsg(PeekResultMsg{Type: "peek_result", SlotIndex: msg.SlotIndex, Card: *card})
}

// sendYourTurn sends a your_turn message to the player whose turn it is.
func (c *Client) sendYourTurn(currentTurn int, p1, p2 *Client) {
	yourTurn := YourTurnMsg{Type: "your_turn"}
	if currentTurn == 1 && p1 != nil {
		p1.SendMsg(yourTurn)
	} else if currentTurn == 2 && p2 != nil {
		p2.SendMsg(yourTurn)
	}
}

func (c *Client) cleanup() {
	close(c.send)
	if c.room != nil {
		if partner := c.room.Partner(c); partner != nil {
			partner.SendMsg(PlayerDisconnectedMsg{
				Type:       "player_disconnected",
				PlayerName: c.name,
			})
		}
		empty := c.room.RemovePlayer(c)
		if empty {
			c.rooms.RemoveRoom(c.room.Code)
		}
		slog.Info("player disconnected", "player", c.name, "room", c.room.Code)
	}
}
