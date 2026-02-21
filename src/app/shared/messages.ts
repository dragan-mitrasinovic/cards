export interface BaseMessage {
  type: string;
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

export type ClientMessage = EchoMessage | CreateRoomMessage | JoinRoomMessage;

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

export type ServerMessage =
  | EchoResponseMessage
  | ErrorMessage
  | RoomCreatedMessage
  | PlayerJoinedMessage
  | PlayerDisconnectedMessage;
