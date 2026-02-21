package main

import (
	"encoding/json"
	"fmt"
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
	case "suggest_swap":
		c.handleSuggestSwap(raw)
	case "skip_swap":
		c.handleSkipSwap()
	case "respond_swap":
		c.handleRespondSwap(raw)
	case "play_again":
		c.handlePlayAgain()
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

		c.room.RemovePlayer(c)

		if c.room.IsEmpty() {
			c.rooms.RemoveRoom(c.room.Code)
		}

		slog.Info("player disconnected", "player", c.name, "room", c.room.Code)
	}
}

// broadcast sends a message to both players. Either may be nil.
func broadcast(p1, p2 *Client, msg any) {
	if p1 != nil {
		p1.SendMsg(msg)
	}

	if p2 != nil {
		p2.SendMsg(msg)
	}
}

// sendYourTurn sends a your_turn message to the player whose turn it is.
func sendYourTurn(currentTurn int, p1, p2 *Client) {
	yourTurn := YourTurnMsg{Type: "your_turn"}

	if currentTurn == 1 && p1 != nil {
		p1.SendMsg(yourTurn)
	} else if currentTurn == 2 && p2 != nil {
		p2.SendMsg(yourTurn)
	}
}

// sendRevealCards sends reveal_card messages to both players with staggered delays,
// followed by the game_result message.
func sendRevealCards(p1, p2 *Client, order []RevealEntry, win bool) {
	const delayPerCard = 800 // ms between reveals

	for i, entry := range order {
		broadcast(p1, p2, RevealCardMsg{
			Type:      "reveal_card",
			SlotIndex: entry.SlotIndex,
			Card:      entry.Card,
			Delay:     i * delayPerCard,
		})
	}

	boardCards := make([]BoardCard, 0, len(order))
	for _, entry := range order {
		boardCards = append(boardCards, BoardCard{SlotIndex: entry.SlotIndex, Card: entry.Card})
	}

	broadcast(p1, p2, GameResultMsg{
		Type:  "game_result",
		Win:   win,
		Board: boardCards,
	})
}

// validateName trims and validates a player name.
func validateName(raw string) (string, error) {
	name := strings.TrimSpace(raw)

	if name == "" {
		return "", fmt.Errorf("name is required")
	}

	if len(name) > 20 {
		return "", fmt.Errorf("name too long")
	}

	return name, nil
}
