import { getSocket } from './socket';

// Tiny ack-promisifying wrapper around the server's game:* socket protocol.
// Returns a Promise<{success, reason?, ...}> for each action so components
// can `await` and handle UI state cleanly. Falls back to a rejected promise
// when the socket isn't connected yet — caller should toast that.

function emit(event, payload = {}) {
  const sk = getSocket();
  if (!sk) return Promise.reject(new Error('Not connected'));
  return new Promise((resolve) => {
    sk.emit(event, payload, (res) => resolve(res || { success: true }));
  });
}

export const gameApi = {
  start:     ()                            => emit('game:start'),
  playCard:  (cardId, chosenColor = null)  => emit('game:play_card', { cardId, chosenColor }),
  drawCard:  ()                            => emit('game:draw_card'),
  pass:      ()                            => emit('game:pass'),
  callUno:   ()                            => emit('game:call_uno'),
  catchUno:  (targetId)                    => emit('game:catch_uno', { targetId }),
  reaction:  (emoji)                       => { const sk = getSocket(); sk?.emit('game:reaction', { emoji }); },
  // Room chat: send free-form 200-char message. Server broadcasts to room
  // as 'chat:message' with { id, userId, username, text, createdAt }.
  chatSend:  (text)                        => emit('chat:send', { text }),
  // Quick-chat: ID into server's preset table (1–12). Server validates and
  // broadcasts 'chat:quick' with { playerId, username, id, text }.
  quickChat: (id)                          => emit('chat:quick', { id }),
  leaveRoom: ()                            => emit('room:leave'),
  joinRoom:  (roomId, password)            => emit('room:join', { roomId, password }),
};
