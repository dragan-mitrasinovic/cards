package main

import (
	"encoding/json"
	"log/slog"
	"strings"
)

func (c *Client) handleCreateRoom(raw []byte) {
	var msg CreateRoomMsg
	if err := json.Unmarshal(raw, &msg); err != nil {
		c.SendMsg(newError("invalid create_room message"))
		return
	}

	name, err := validateName(msg.Name)
	if err != nil {
		c.SendMsg(newError(err.Error()))
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

	name, err := validateName(msg.Name)
	if err != nil {
		c.SendMsg(newError(err.Error()))
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
			c.SendMsg(TurnOrderPromptMsg{Type: "turn_order_prompt", Hand: game.Hands[c.playerNumber-1][:]})
			partner.SendMsg(TurnOrderPromptMsg{Type: "turn_order_prompt", Hand: game.Hands[partner.playerNumber-1][:]})
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

		broadcast(p1, p2, result)
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

	broadcast(p1, p2, result)

	// Send game_start with each player's hand
	if p1 != nil {
		p1.SendMsg(GameStartMsg{Type: "game_start", Hand: hand1, FirstPlayer: firstPlayer})
	}

	if p2 != nil {
		p2.SendMsg(GameStartMsg{Type: "game_start", Hand: hand2, FirstPlayer: firstPlayer})
	}

	sendYourTurn(firstPlayer, p1, p2)
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

	var revealOrder []RevealEntry
	var win bool
	if phase == PhaseReveal {
		revealOrder, win = game.FinalizeReveal()
	}

	p1 := c.room.Players[0]
	p2 := c.room.Players[1]
	c.room.mu.Unlock()

	slog.Info("card placed", "player", c.name, "slot", msg.SlotIndex, "room", c.room.Code)

	broadcast(p1, p2, CardPlacedMsg{Type: "card_placed", SlotIndex: msg.SlotIndex, ByPlayer: c.playerNumber})

	if phase == PhaseSwap {
		broadcast(p1, p2, SwapPromptMsg{Type: "swap_prompt", ByPlayer: currentTurn})
	} else if phase == PhaseReveal {
		sendRevealCards(p1, p2, revealOrder, win)
	} else {
		sendYourTurn(currentTurn, p1, p2)
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

	broadcast(p1, p2, PlayerPassedMsg{Type: "player_passed", ByPlayer: c.playerNumber})

	sendYourTurn(currentTurn, p1, p2)
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

func (c *Client) handleSuggestSwap(raw []byte) {
	var msg SuggestSwapMsg
	if err := json.Unmarshal(raw, &msg); err != nil {
		c.SendMsg(newError("invalid suggest_swap message"))
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

	if err := game.SuggestSwap(c.playerNumber, msg.SlotA, msg.SlotB); err != nil {
		c.room.mu.Unlock()
		c.SendMsg(newError(err.Error()))
		return
	}

	slotA := game.SwapSlots[0]
	slotB := game.SwapSlots[1]
	p1 := c.room.Players[0]
	p2 := c.room.Players[1]
	c.room.mu.Unlock()

	slog.Info("swap suggested", "player", c.name, "slotA", slotA, "slotB", slotB, "room", c.room.Code)

	broadcast(p1, p2, SwapSuggestedMsg{Type: "swap_suggested", SlotA: slotA, SlotB: slotB, ByPlayer: c.playerNumber})
}

func (c *Client) handleSkipSwap() {
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

	if err := game.SkipSwap(c.playerNumber); err != nil {
		c.room.mu.Unlock()
		c.SendMsg(newError(err.Error()))
		return
	}

	phase := game.Phase
	currentTurn := game.CurrentTurn

	var revealOrder []RevealEntry
	var win bool
	if phase == PhaseReveal {
		revealOrder, win = game.FinalizeReveal()
	}

	p1 := c.room.Players[0]
	p2 := c.room.Players[1]
	c.room.mu.Unlock()

	slog.Info("swap skipped", "player", c.name, "room", c.room.Code)

	broadcast(p1, p2, SwapResultMsg{Type: "swap_result", Accepted: false})

	if phase == PhaseSwap {
		broadcast(p1, p2, SwapPromptMsg{Type: "swap_prompt", ByPlayer: currentTurn})
	} else if phase == PhaseReveal {
		sendRevealCards(p1, p2, revealOrder, win)
	}
}

func (c *Client) handleRespondSwap(raw []byte) {
	var msg RespondSwapMsg
	if err := json.Unmarshal(raw, &msg); err != nil {
		c.SendMsg(newError("invalid respond_swap message"))
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

	slotA := game.SwapSlots[0]
	slotB := game.SwapSlots[1]
	suggester := game.SwapSuggester
	phaseBefore := game.Phase
	turnBefore := game.CurrentTurn

	if err := game.RespondSwap(c.playerNumber, msg.Accept); err != nil {
		c.room.mu.Unlock()
		c.SendMsg(newError(err.Error()))
		return
	}

	phase := game.Phase
	currentTurn := game.CurrentTurn
	phaseChanged := phase != phaseBefore || currentTurn != turnBefore

	var revealOrder []RevealEntry
	var win bool
	if phase == PhaseReveal && phaseChanged {
		revealOrder, win = game.FinalizeReveal()
	}

	p1 := c.room.Players[0]
	p2 := c.room.Players[1]
	c.room.mu.Unlock()

	slog.Info("swap response", "player", c.name, "accepted", msg.Accept, "room", c.room.Code)

	result := SwapResultMsg{Type: "swap_result", Accepted: msg.Accept}
	if msg.Accept {
		result.SlotA = slotA
		result.SlotB = slotB
		result.ByPlayer = suggester
	}

	broadcast(p1, p2, result)

	// Only send follow-up messages if the swap advanced the game state
	if phaseChanged {
		if phase == PhaseSwap {
			broadcast(p1, p2, SwapPromptMsg{Type: "swap_prompt", ByPlayer: currentTurn})
		} else if phase == PhaseReveal {
			sendRevealCards(p1, p2, revealOrder, win)
		}
	}
}

func (c *Client) handlePlayAgain() {
	if c.room == nil {
		c.SendMsg(newError("no active game"))
		return
	}

	c.room.mu.Lock()
	game := c.room.Game
	if game == nil || game.Phase != PhaseGameOver {
		c.room.mu.Unlock()
		c.SendMsg(newError("game is not over"))
		return
	}

	idx := c.playerNumber - 1
	if c.room.PlayAgainReady[idx] {
		c.room.mu.Unlock()
		c.SendMsg(newError("already requested rematch"))
		return
	}

	c.room.PlayAgainReady[idx] = true
	bothReady := c.room.PlayAgainReady[0] && c.room.PlayAgainReady[1]
	p1 := c.room.Players[0]
	p2 := c.room.Players[1]
	c.room.mu.Unlock()

	slog.Info("play again requested", "player", c.name, "room", c.room.Code)

	if !bothReady {
		broadcast(p1, p2, PlayAgainWaitingMsg{Type: "play_again_waiting", PlayerName: c.name})
		return
	}

	// Both ready — start new game
	newGame, err := c.room.ResetGame()
	if err != nil {
		slog.Error("failed to reset game for rematch", "error", err, "room", c.room.Code)
		c.SendMsg(newError("failed to start rematch"))
		return
	}

	slog.Info("rematch started", "room", c.room.Code, "phase", newGame.Phase)

	if p1 != nil {
		p1.SendMsg(TurnOrderPromptMsg{Type: "turn_order_prompt", Hand: newGame.Hands[0][:]})
	}

	if p2 != nil {
		p2.SendMsg(TurnOrderPromptMsg{Type: "turn_order_prompt", Hand: newGame.Hands[1][:]})
	}
}
