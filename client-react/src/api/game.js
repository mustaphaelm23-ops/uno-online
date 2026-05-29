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
  leaveRoom: ()                            => emit('room:leave'),
  joinRoom:  (roomId, password)            => emit('room:join', { roomId, password }),
};
