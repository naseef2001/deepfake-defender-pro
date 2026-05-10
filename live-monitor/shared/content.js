// Deepfake Defender - Balanced Thresholds
console.log('%c🔥 DEEPFAKE DEFENDER LOADED', 'background: #4CAF50; color: white; font-size: 16px; padding: 5px;');
console.log('🔍 Debug mode ACTIVE');

// =========================================================
// CONFIGURATION - CHANGE THESE IF NEEDED
// =========================================================
const KALI_IP = '192.168.152.128';  // Your Kali VM IP
const USE_SSL = true;                // Set to false if no SSL
const WS_URL = USE_SSL ? 
    `wss://${KALI_IP}:8001/ws/meeting` : 
    `ws://${KALI_IP}:8001/ws/meeting`;

console.log('📡 Kali IP:', KALI_IP);
console.log('🔌 WebSocket URL:', WS_URL);

// =========================================================
// GLOBAL VARIABLES
// =========================================================
let ws = null;
let participantId = 'user_' + Math.random().toString(36).substr(2, 9);
let reconnectAttempts = 0;
let frameInterval = null;
let isConnected = false;

// =========================================================
// ADD VISUAL INDICATOR TO PAGE
// =========================================================
function addIndicator() {
    console.log('🏁 Adding indicator to page...');
    
    const existing = document.getElementById('dfd-indicator');
    if (existing) existing.remove();
    
    const indicator = document.createElement('div');
    indicator.id = 'dfd-indicator';
    indicator.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 12px 20px;
        border-radius: 50px;
        z-index: 999999;
        font-family: Arial, sans-serif;
        font-size: 14px;
        font-weight: bold;
        box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        border: 2px solid white;
        cursor: pointer;
        transition: all 0.3s ease;
    `;

    indicator.onmouseover = () => indicator.style.transform = 'scale(1.05)';
    indicator.onmouseout = () => indicator.style.transform = 'scale(1)';
    indicator.onclick = () => showStatus();

    indicator.innerHTML = '🛡️ Deepfake Defender <span style="font-size: 10px; margin-left: 5px;">(Connecting...)</span>';
    document.body.appendChild(indicator);
    console.log('✅ Indicator added to page');
}

// =========================================================
// SHOW DETAILED STATUS
// =========================================================
function showStatus() {
    const status = `🛡️ Deepfake Defender Status:
    
🔌 WebSocket: ${ws ? (ws.readyState === 1 ? '✅ Connected' : '❌ Disconnected') : '❌ Not initialized'}
🆔 Participant ID: ${participantId}
📡 Kali IP: ${KALI_IP}
🔒 SSL: ${USE_SSL ? 'Enabled' : 'Disabled'}
🔄 Reconnect attempts: ${reconnectAttempts}
📹 Frame capture: ${frameInterval ? '✅ Active' : '❌ Inactive'}`;
    
    alert(status);
}

// =========================================================
// GET MEETING INFO
// =========================================================
function getMeetingId() {
    const url = window.location.href;
    const match = url.match(/meet\.google\.com\/([^?#]+)/);
    return match ? match[1] : 'unknown-meeting';
}

function getParticipantName() {
    const nameEl = document.querySelector('[aria-label*="You"]');
    if (nameEl) {
        return nameEl.getAttribute('aria-label') || 'User';
    }
    return 'User';
}

// =========================================================
// WEBSOCKET CONNECTION
// =========================================================
function connectWebSocket() {
    console.log('🔌 Attempting WebSocket connection to:', WS_URL);
    
    try {
        ws = new WebSocket(WS_URL);
        
        ws.onopen = () => {
            console.log('✅ WebSocket CONNECTED successfully!');
            isConnected = true;
            reconnectAttempts = 0;
            
            const indicator = document.getElementById('dfd-indicator');
            if (indicator) {
                indicator.innerHTML = '🛡️ Deepfake Defender <span style="font-size: 10px; color: #00ff00;">(Connected)</span>';
            }
            
            const joinMsg = {
                type: 'join',
                participant_id: participantId,
                meeting_id: getMeetingId(),
                name: getParticipantName()
            };
            console.log('📤 Sending join message:', joinMsg);
            ws.send(JSON.stringify(joinMsg));
        };
        
        ws.onmessage = (event) => {
            console.log('📩 Received:', event.data);
            try {
                const data = JSON.parse(event.data);
                
                if (data.type === 'join_confirmed') {
                    console.log('✅ Join confirmed for meeting:', data.meeting_id);
                    startFrameCapture();
                }
                else if (data.type === 'analysis') {
                    console.log('📊 Analysis result:', data);
                    updateIndicatorWithResult(data);
                }
                else if (data.type === 'alert') {
                    console.log('⚠️ ALERT:', data.message);
                    showAlert(data);
                }
                else if (data.type === 'pong') {
                    console.log('🏓 Pong received');
                }
            } catch (e) {
                console.error('❌ Error parsing message:', e);
            }
        };
        
        ws.onerror = (error) => {
            console.error('❌ WebSocket error:', error);
            isConnected = false;
            const indicator = document.getElementById('dfd-indicator');
            if (indicator) {
                indicator.innerHTML = '🛡️ Deepfake Defender <span style="font-size: 10px; color: #ff4444;">(Error)</span>';
            }
        };
        
        ws.onclose = (event) => {
            console.log(`🔌 WebSocket closed (code: ${event.code})`);
            isConnected = false;
            reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
            console.log(`🔄 Reconnecting in ${delay/1000}s... (attempt ${reconnectAttempts})`);
            setTimeout(connectWebSocket, delay);
            const indicator = document.getElementById('dfd-indicator');
            if (indicator) {
                indicator.innerHTML = '🛡️ Deepfake Defender <span style="font-size: 10px; color: #ffaa00;">(Reconnecting...)</span>';
            }
        };
        
    } catch (e) {
        console.error('❌ Failed to create WebSocket:', e);
    }
}

// =========================================================
// FRAME CAPTURE
// =========================================================
function startFrameCapture() {
    console.log('🎥 Starting frame capture...');
    
    if (frameInterval) {
        clearInterval(frameInterval);
        frameInterval = null;
    }
    
    const videos = document.querySelectorAll('video');
    console.log('📹 Found', videos.length, 'video elements');
    
    if (videos.length === 0) {
        console.log('❌ No videos found - will retry in 3 seconds');
        setTimeout(startFrameCapture, 3000);
        return;
    }
    
    const video = videos[0];
    console.log('🎥 Using video element:', video);
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    frameInterval = setInterval(() => {
        if (!isConnected || !ws || ws.readyState !== WebSocket.OPEN) {
            console.log('⏳ WebSocket not ready, skipping frame');
            return;
        }
        
        if (video.readyState < 2) {
            console.log('⏳ Video not ready, skipping frame');
            return;
        }
        
        try {
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 480;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            canvas.toBlob((blob) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64data = reader.result.split(',')[1];
                    ws.send(JSON.stringify({
                        type: 'frame',
                        participant_id: participantId,
                        data: base64data,
                        timestamp: Date.now()
                    }));
                    console.log('📤 Frame sent', new Date().toLocaleTimeString());
                };
                reader.readAsDataURL(blob);
            }, 'image/jpeg', 0.6);
        } catch (e) {
            console.error('❌ Frame capture error:', e);
        }
    }, 3000);
    
    console.log('✅ Frame capture started');
}

// =========================================================
// UPDATE INDICATOR WITH RESULTS (BALANCED THRESHOLDS)
// =========================================================
function updateIndicatorWithResult(data) {
    const indicator = document.getElementById('dfd-indicator');
    if (!indicator) return;
    
    const confidence = data.confidence || 0.5;
    const isFake = data.is_deepfake || false;
    
    let color = '#00ff00';
    let text = 'REAL';
    let emoji = '🛡️';
    
    // BALANCED THRESHOLDS:
    // - RED: if server says deepfake (confidence > 0.75) OR confidence > 0.8
    // - YELLOW: if confidence > 0.6 but not deepfake (suspicious)
    // - GREEN: confidence <= 0.6
    if (isFake || confidence > 0.8) {
        color = '#ff0000';
        text = 'DEEPFAKE';
        emoji = '⚠️';
    } else if (confidence > 0.75) {
        color = '#ffaa00';
        text = 'SUSPICIOUS';
        emoji = '⚠️';
    } else if (confidence > 0.73) {
        color = '#667eea';
        text = 'ANALYZING';
        emoji = '🛡️';
    } else {
        color = '#00ff00';
        text = 'REAL';
        emoji = '🛡️';
    }
    
    indicator.style.background = `linear-gradient(135deg, #667eea 0%, ${color} 100%)`;
    indicator.innerHTML = `${emoji} Deepfake Defender <span style="font-size: 10px; margin-left: 5px;">${text} (${(confidence*100).toFixed(0)}%)</span>`;
}

// =========================================================
// SHOW ALERT
// =========================================================
function showAlert(data) {
    const alertDiv = document.createElement('div');
    alertDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(255, 0, 0, 0.9);
        color: white;
        padding: 20px 30px;
        border-radius: 10px;
        z-index: 1000000;
        font-family: Arial;
        font-size: 18px;
        font-weight: bold;
        box-shadow: 0 0 30px rgba(255,0,0,0.5);
        border: 2px solid white;
    `;
    alertDiv.innerHTML = `
        ⚠️ DEEPFAKE ALERT!<br>
        Confidence: ${(data.confidence*100).toFixed(0)}%<br>
        <button onclick="this.parentElement.remove()" style="margin-top:10px; padding:5px 15px;">OK</button>
    `;
    document.body.appendChild(alertDiv);
    setTimeout(() => alertDiv.remove(), 5000);
}

// =========================================================
// INITIALIZATION
// =========================================================
function initialize() {
    console.log('🚀 Initializing Deepfake Defender...');
    addIndicator();
    setTimeout(() => {
        connectWebSocket();
        const videos = document.querySelectorAll('video');
        if (videos.length > 0) {
            console.log('📹 Videos already present, will start capture after connection');
        }
    }, 2000);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}

// Make variables available for debugging
window.dfdWs = ws;
window.dfdParticipantId = participantId;
window.dfdTestConnection = function() {
    console.log('Testing connection...');
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({type: 'ping'}));
        console.log('✅ Ping sent');
    } else {
        console.log('❌ WebSocket not connected');
    }
};