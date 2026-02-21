export interface BaseMessage {
  type: string;
}

// --- Client → Server messages ---

export interface EchoMessage extends BaseMessage {
  type: 'echo';
  payload: string;
}

export type ClientMessage = EchoMessage;

// --- Server → Client messages ---

export interface EchoResponseMessage extends BaseMessage {
  type: 'echo';
  payload: string;
}

export interface ErrorMessage extends BaseMessage {
  type: 'error';
  message: string;
}

export type ServerMessage = EchoResponseMessage | ErrorMessage;
