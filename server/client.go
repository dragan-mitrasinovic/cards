package main

import (
	"encoding/json"
	"log/slog"
	"time"

	"github.com/gorilla/websocket"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 4096
	maxNameLength  = 20
	delayPerCard   = 800 // ms between reveals
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
		slog.Error("send buffer full, disconnecting client", "player", c.name)
		c.conn.Close()
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
				slog.Warn("write deadline error", "player", c.name, "error", err)
				return
			}

			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
				slog.Warn("write error", "player", c.name, "error", err)
				return
			}

		case <-ticker.C:
			if err := c.conn.SetWriteDeadline(time.Now().Add(writeWait)); err != nil {
				slog.Warn("ping deadline error", "player", c.name, "error", err)
				return
			}

			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				slog.Warn("ping error", "player", c.name, "error", err)
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
	case "reconnect":
		c.handleReconnect(raw)
	case "turn_order_pick":
		c.handleTurnOrderPick(raw)
	case "place_card":
		c.handlePlaceCard(raw)
	case "pass":
		c.handlePass()
	case "peek":
		c.handlePeek(raw)
	case "suggest_swap":
		c.handleSuggestSwap(raw)
	case "skip_swap":
		c.handleSkipSwap()
	case "respond_swap":
		c.handleRespondSwap(raw)
	case "play_again":
		c.handlePlayAgain()
	case "echo":
		// Heartbeat — no action needed
	default:
		c.SendMsg(newError("unknown message type: " + env.Type))
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

		// Mark as disconnected with grace period instead of removing immediately
		c.room.DisconnectPlayer(c, c.rooms)
		slog.Info("player disconnected", "player", c.name, "room", c.room.Code)
	}
}

// broadcast sends a message to both players, skipping nil clients.
func broadcast(p1, p2 *Client, msg any) {
	if p1 != nil {
		p1.SendMsg(msg)
	}

	if p2 != nil {
		p2.SendMsg(msg)
	}
}
