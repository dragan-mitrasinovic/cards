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
