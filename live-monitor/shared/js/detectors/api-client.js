/**
 * Deepfake Defender Live - API Client
 * Handles communication with backend services
 */

class DeepfakeAPIClient {
    constructor(config = {}) {
        this.apiUrl = config.apiUrl || 'http://localhost:8000';
        this.wsUrl = config.wsUrl || 'ws://localhost:8001/ws/meeting';
        this.token = null;
        this.ws = null;
        this.participantId = null;
        this.meetingId = null;
        this.callbacks = {
            onAnalysis: [],
            onAlert: [],
            onJoin: [],
            onLeave: [],
            onError: []
        };
    }

    // =========================================================
    // Authentication
    // =========================================================

    async login(username = 'admin', password = 'secret') {
        try {
            const formData = new URLSearchParams();
            formData.append('username', username);
            formData.append('password', password);

            const response = await fetch(`${this.apiUrl}/token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: formData
            });

            if (!response.ok) {
                throw new Error('Login failed');
            }

            const data = await response.json();
            this.token = data.access_token;
            
            // Store token
            await this._storeToken(this.token);
            
            return this.token;
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    }

    async _storeToken(token) {
        return new Promise((resolve) => {
            chrome.storage.local.set({ dfd_token: token }, resolve);
        });
    }

    async _getToken() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['dfd_token'], (result) => {
                resolve(result.dfd_token);
            });
        });
    }

    // =========================================================
    // WebSocket Connection
    // =========================================================

    async connect(meetingId, participantName) {
        this.meetingId = meetingId;
        
        // Get or create participant ID
        this.participantId = await this._getParticipantId();
        
        // Get token if not present
        if (!this.token) {
            this.token = await this._getToken();
            if (!this.token) {
                await this.login();
            }
        }

        // Connect WebSocket
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(this.wsUrl);
            
            this.ws.onopen = () => {
                console.log('✅ WebSocket connected');
                this._joinMeeting(participantName);
                resolve();
            };
            
            this.ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                this._handleMessage(data);
            };
            
            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this._triggerCallbacks('onError', error);
                reject(error);
            };
            
            this.ws.onclose = () => {
                console.log('WebSocket disconnected');
                this._attemptReconnect();
            };
        });
    }

    _joinMeeting(participantName) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        
        this.ws.send(JSON.stringify({
            type: 'join',
            meeting_id: this.meetingId,
            participant_id: this.participantId,
            name: participantName,
            token: this.token
        }));
    }

    _handleMessage(data) {
        switch (data.type) {
            case 'join_confirmed':
                this._triggerCallbacks('onJoin', data);
                break;
                
            case 'participant_left':
                this._triggerCallbacks('onLeave', data);
                break;
                
            case 'analysis':
                this._triggerCallbacks('onAnalysis', data);
                break;
                
            case 'alert':
                this._triggerCallbacks('onAlert', data);
                break;
                
            case 'participants_list':
                data.participants.forEach(p => {
                    this._triggerCallbacks('onAnalysis', {
                        participant_id: p.participant_id,
                        confidence: p.avg_confidence || 0.5,
                        is_deepfake: p.avg_confidence > 0.6
                    });
                });
                break;
                
            case 'pong':
                console.log('🏓 Pong received');
                break;
        }
    }

    _attemptReconnect() {
        setTimeout(() => {
            console.log('Attempting to reconnect...');
            this.connect(this.meetingId);
        }, 5000);
    }

    // =========================================================
    // Data Sending
    // =========================================================

    sendFrame(frameData, participantIndex = 0) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        
        this.ws.send(JSON.stringify({
            type: 'frame',
            participant_id: this.participantId,
            data: frameData,
            participant_index: participantIndex
        }));
    }

    sendAudio(audioData) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        
        this.ws.send(JSON.stringify({
            type: 'audio',
            participant_id: this.participantId,
            data: audioData
        }));
    }

    sendChatMessage(message, sender) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        
        this.ws.send(JSON.stringify({
            type: 'chat',
            participant_id: this.participantId,
            message: message,
            sender: sender
        }));
    }

    sendPing() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        
        this.ws.send(JSON.stringify({
            type: 'ping'
        }));
    }

    // =========================================================
    // Participant Management
    // =========================================================

    async _getParticipantId() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['dfd_participant_id'], (result) => {
                if (result.dfd_participant_id) {
                    resolve(result.dfd_participant_id);
                } else {
                    const id = 'participant_' + Math.random().toString(36).substr(2, 9);
                    chrome.storage.local.set({ dfd_participant_id: id }, () => {
                        resolve(id);
                    });
                }
            });
        });
    }

    // =========================================================
    // Event Handling
    // =========================================================

    on(event, callback) {
        if (this.callbacks[event]) {
            this.callbacks[event].push(callback);
        }
    }

    off(event, callback) {
        if (this.callbacks[event]) {
            this.callbacks[event] = this.callbacks[event].filter(cb => cb !== callback);
        }
    }

    _triggerCallbacks(event, data) {
        if (this.callbacks[event]) {
            this.callbacks[event].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Callback error for ${event}:`, error);
                }
            });
        }
    }

    // =========================================================
    // Connection Management
    // =========================================================

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    isConnected() {
        return this.ws && this.ws.readyState === WebSocket.OPEN;
    }

    // =========================================================
    // Settings
    // =========================================================

    async getSettings() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['dfd_settings'], (result) => {
                resolve(result.dfd_settings || {
                    faceDetection: true,
                    voiceDetection: true,
                    chatDetection: true,
                    confidenceThreshold: 0.6,
                    showOverlay: true,
                    enableAlerts: true,
                    theme: 'dark'
                });
            });
        });
    }

    async updateSettings(settings) {
        return new Promise((resolve) => {
            chrome.storage.local.set({ dfd_settings: settings }, resolve);
        });
    }
}

// Export for use in content scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DeepfakeAPIClient;
}
