export interface BaseMessage {
  type: string;
}

/** Card represents a single playing card with suit and value. */
export interface Card {
  suit: string;
  value: number;
}

// --- Client → Server messages ---

export interface EchoMessage extends BaseMessage {
  type: 'echo';
  payload: string;
}

export interface CreateRoomMessage extends BaseMessage {
  type: 'create_room';
  name: string;
}

export interface JoinRoomMessage extends BaseMessage {
  type: 'join_room';
  name: string;
  roomCode: string;
}

export interface TurnOrderPickMessage extends BaseMessage {
  type: 'turn_order_pick';
  preference: 'first' | 'neutral' | 'no_first';
}

export interface PlaceCardMessage extends BaseMessage {
  type: 'place_card';
  cardIndex: number;
  slotIndex: number;
}

export interface PassMessage extends BaseMessage {
  type: 'pass';
}

export interface PeekMessage extends BaseMessage {
  type: 'peek';
  slotIndex: number;
}

export interface SuggestSwapMessage extends BaseMessage {
  type: 'suggest_swap';
  slotA: number;
  slotB: number;
}

export interface SkipSwapMessage extends BaseMessage {
  type: 'skip_swap';
}

export interface RespondSwapMessage extends BaseMessage {
  type: 'respond_swap';
  accept: boolean;
}

export type ClientMessage = EchoMessage | CreateRoomMessage | JoinRoomMessage | TurnOrderPickMessage | PlaceCardMessage | PassMessage | PeekMessage | SuggestSwapMessage | SkipSwapMessage | RespondSwapMessage;

// --- Server → Client messages ---

export interface EchoResponseMessage extends BaseMessage {
  type: 'echo';
  payload: string;
}

export interface ErrorMessage extends BaseMessage {
  type: 'error';
  message: string;
}

export interface RoomCreatedMessage extends BaseMessage {
  type: 'room_created';
  roomCode: string;
  playerNumber: number;
}

export interface PlayerJoinedMessage extends BaseMessage {
  type: 'player_joined';
  playerName: string;
  playerNumber: number;
  partnerName: string;
}

export interface PlayerDisconnectedMessage extends BaseMessage {
  type: 'player_disconnected';
  playerName: string;
}

export interface TurnOrderPromptMessage extends BaseMessage {
  type: 'turn_order_prompt';
}

export interface TurnOrderResultMessage extends BaseMessage {
  type: 'turn_order_result';
  pick1: string;
  pick2: string;
  conflict: boolean;
  firstPlayer?: number;
}

export interface GameStartMessage extends BaseMessage {
  type: 'game_start';
  hand: Card[];
  firstPlayer: number;
}

export interface YourTurnMessage extends BaseMessage {
  type: 'your_turn';
}

export interface CardPlacedMessage extends BaseMessage {
  type: 'card_placed';
  slotIndex: number;
  byPlayer: number;
}

export interface PlayerPassedMessage extends BaseMessage {
  type: 'player_passed';
  byPlayer: number;
}

export interface PeekResultMessage extends BaseMessage {
  type: 'peek_result';
  slotIndex: number;
  card: Card;
}

export interface SwapPromptMessage extends BaseMessage {
  type: 'swap_prompt';
  byPlayer: number;
}

export interface SwapSuggestedMessage extends BaseMessage {
  type: 'swap_suggested';
  slotA: number;
  slotB: number;
  byPlayer: number;
}

export interface SwapResultMessage extends BaseMessage {
  type: 'swap_result';
  accepted: boolean;
  slotA?: number;
  slotB?: number;
}

export type ServerMessage =
  | EchoResponseMessage
  | ErrorMessage
  | RoomCreatedMessage
  | PlayerJoinedMessage
  | PlayerDisconnectedMessage
  | TurnOrderPromptMessage
  | TurnOrderResultMessage
  | GameStartMessage
  | YourTurnMessage
  | CardPlacedMessage
  | PlayerPassedMessage
  | PeekResultMessage
  | SwapPromptMessage
  | SwapSuggestedMessage
  | SwapResultMessage;
