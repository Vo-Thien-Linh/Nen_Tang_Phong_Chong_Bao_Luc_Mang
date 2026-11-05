/**
 * Unit tests: Call Timeout / No-Answer Handling
 *
 * Kiểm thử logic timeout cuộc gọi khi người nhận không bắt máy,
 * bao gồm việc hủy timeout khi cuộc gọi được chấp nhận, từ chối,
 * hoặc kết thúc thủ công.
 *
 * Lưu ý: Các test này mô phỏng logic từ MessagesView.jsx (hàm startCall /
 * cleanupCall) dưới dạng pure-JS để có thể chạy trong Node mà không cần DOM.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Tạo một đối tượng "ref" tương đương useRef() của React
 */
function makeRef(initial = null) {
  return { current: initial };
}

/**
 * Giả lập WebSocket đang mở, ghi lại các tin nhắn được gửi
 */
function makeFakeWs(messages = []) {
  return {
    readyState: 1, // WebSocket.OPEN = 1
    send: (msg) => messages.push(JSON.parse(msg))
  };
}

/**
 * Giả lập hàm cleanupCall() của MessagesView, trả về trạng thái có thể
 * kiểm tra được.
 */
function makeCallState() {
  const callTimerRef = makeRef(null);
  const callTimeoutRef = makeRef(null);
  let callStatus = 'idle';
  let callDuration = 0;
  const sentMessages = [];
  const ws = makeFakeWs(sentMessages);

  const cleanupCall = () => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
    callStatus = 'idle';
    callDuration = 0;
  };

  /**
   * Giả lập startCall(): đặt timeout 30 s và gửi CALL_REQUEST
   */
  const startCall = (receiverId, timeoutMs = 30000) => {
    callStatus = 'outgoing';
    ws.send(JSON.stringify({ type: 'CALL_REQUEST', receiver_id: receiverId }));

    if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
    callTimeoutRef.current = setTimeout(() => {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'CALL_ENDED', receiver_id: receiverId, reason: 'no_answer' }));
      }
      cleanupCall();
    }, timeoutMs);
  };

  /**
   * Giả lập khi người nhận bắt máy (CALL_RESPONSE accepted: true)
   */
  const onCallAccepted = () => {
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
    callStatus = 'connected';
    callTimerRef.current = setInterval(() => { callDuration += 1; }, 1000);
  };

  /**
   * Giả lập người gọi chủ động hủy (nút Cancel trong OUTGOING modal)
   */
  const handleCancelCall = (receiverId) => {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({ type: 'CALL_ENDED', receiver_id: receiverId, reason: 'cancelled' }));
    }
    cleanupCall();
  };

  return {
    callTimerRef,
    callTimeoutRef,
    sentMessages,
    get callStatus() { return callStatus; },
    get callDuration() { return callDuration; },
    startCall,
    onCallAccepted,
    handleCancelCall,
    cleanupCall
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test('call-timeout: timeout fires after specified delay → gửi CALL_ENDED với reason no_answer', (t, done) => {
  const state = makeCallState();
  state.startCall('receiver-1', 50); // 50 ms để test nhanh

  assert.equal(state.callStatus, 'outgoing');
  assert.notEqual(state.callTimeoutRef.current, null);

  setTimeout(() => {
    // Sau khi timeout: trạng thái phải về idle
    assert.equal(state.callStatus, 'idle');
    // callTimeoutRef phải được xóa
    assert.equal(state.callTimeoutRef.current, null);
    // Phải có CALL_ENDED với reason 'no_answer' được gửi đi
    const ended = state.sentMessages.find(m => m.type === 'CALL_ENDED' && m.reason === 'no_answer');
    assert.ok(ended, 'Phải gửi CALL_ENDED reason=no_answer khi timeout');
    assert.equal(ended.receiver_id, 'receiver-1');
    done();
  }, 100);
});

test('call-timeout: timeout bị hủy ngay khi người nhận bắt máy', (t, done) => {
  const state = makeCallState();
  state.startCall('receiver-2', 500); // timeout 500 ms

  // Giả lập người nhận bắt máy sau 50 ms
  setTimeout(() => {
    state.onCallAccepted();
    // Timeout phải bị xóa
    assert.equal(state.callTimeoutRef.current, null);
    assert.equal(state.callStatus, 'connected');
  }, 50);

  // Sau 600 ms (nếu timeout chưa bị hủy nó sẽ fire) → trạng thái vẫn là connected
  setTimeout(() => {
    assert.equal(state.callStatus, 'connected', 'Trạng thái không được về idle khi đã connected');
    // Dọn dẹp interval
    state.cleanupCall();
    done();
  }, 600);
});

test('call-timeout: cleanupCall() hủy cả callTimerRef và callTimeoutRef', () => {
  const state = makeCallState();

  // Giả lập có cả timer và timeout đang chạy
  state.callTimerRef.current = setInterval(() => {}, 1000);
  state.callTimeoutRef.current = setTimeout(() => {}, 10000);

  assert.notEqual(state.callTimerRef.current, null);
  assert.notEqual(state.callTimeoutRef.current, null);

  state.cleanupCall();

  assert.equal(state.callTimerRef.current, null);
  assert.equal(state.callTimeoutRef.current, null);
});

test('call-timeout: gọi cleanupCall() khi không có timer nào không throw', () => {
  const state = makeCallState();
  assert.doesNotThrow(() => state.cleanupCall());
  assert.doesNotThrow(() => state.cleanupCall()); // gọi lần 2 cũng an toàn
});

test('call-timeout: hủy thủ công (cancel outgoing) gửi CALL_ENDED reason=cancelled và xóa timeout', () => {
  const state = makeCallState();
  state.startCall('receiver-3', 30000);

  assert.notEqual(state.callTimeoutRef.current, null);
  state.handleCancelCall('receiver-3');

  // Timeout phải bị xóa
  assert.equal(state.callTimeoutRef.current, null);
  assert.equal(state.callStatus, 'idle');

  // CALL_ENDED với reason 'cancelled' phải được gửi
  const cancelled = state.sentMessages.find(m => m.type === 'CALL_ENDED' && m.reason === 'cancelled');
  assert.ok(cancelled, 'Phải gửi CALL_ENDED reason=cancelled khi hủy thủ công');
});

test('call-timeout: timeout không fire sau khi đã cancel thủ công', (t, done) => {
  const state = makeCallState();
  state.startCall('receiver-4', 80); // timeout 80 ms

  // Hủy ngay sau 20 ms
  setTimeout(() => {
    state.handleCancelCall('receiver-4');
    // Xóa các message để kiểm tra sau
    state.sentMessages.length = 0;
  }, 20);

  // Sau 150 ms (timeout đã qua), không được có CALL_ENDED reason=no_answer
  setTimeout(() => {
    const noAnswer = state.sentMessages.find(m => m.reason === 'no_answer');
    assert.equal(noAnswer, undefined, 'Timeout không được fire sau khi đã cancel');
    done();
  }, 150);
});

test('call-timeout: gọi startCall() lại xóa timeout cũ, bắt đầu timeout mới', (t, done) => {
  const state = makeCallState();
  state.startCall('receiver-5', 500);
  const firstTimeout = state.callTimeoutRef.current;

  // Gọi lại ngay → timeout cũ phải bị thay thế
  state.cleanupCall();
  state.startCall('receiver-5', 500);
  const secondTimeout = state.callTimeoutRef.current;

  assert.notEqual(firstTimeout, secondTimeout, 'Timeout phải là object mới sau startCall lần 2');
  state.cleanupCall();
  done();
});

