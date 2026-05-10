/**
 * Deepfake Defender Live - Overlay Manager
 * Manages the visual overlay showing detection results
 */

class OverlayManager {
    constructor() {
        this.container = null;
        this.participantCards = new Map();
        this.enabled = true;
        this.theme = 'dark';
        this.statusIndicator = null;
    }

    // =========================================================
    // Initialization
    // =========================================================

    async initialize() {
        console.log('🖼️ Overlay Manager initializing...');
        
        // Create overlay container
        this.createContainer();
        
        // Create status indicator
        this.createStatusIndicator();
        
        // Listen for analysis events
        this.setupEventListeners();
        
        // Load settings
        const settings = await this.getSettings();
        this.theme = settings.theme || 'dark';
        this.applyTheme();
    }

    createContainer() {
        this.container = document.createElement('div');
        this.container.id = 'dfd-overlay';
        this.container.className = 'dfd-overlay';
        document.body.appendChild(this.container);
    }

    createStatusIndicator() {
        this.statusIndicator = document.createElement('div');
        this.statusIndicator.className = 'dfd-status';
        this.statusIndicator.innerHTML = `
            <span class="dfd-status-dot"></span>
            <span>Deepfake Defender Active</span>
        `;
        document.body.appendChild(this.statusIndicator);
    }

    setupEventListeners() {
        // Video analysis events
        document.addEventListener('dfd-video-analysis', (event) => {
            this.updateParticipantCard(event.detail);
        });
        
        // Audio analysis events
        document.addEventListener('dfd-audio-analysis', (event) => {
            this.updateParticipantCard(event.detail);
        });
        
        // Chat analysis events
        document.addEventListener('dfd-chat-analysis', (event) => {
            this.showChatAlert(event.detail);
        });
    }

    // =========================================================
    // Participant Cards
    // =========================================================

    updateParticipantCard(data) {
        const participantId = data.participantId;
        
        if (!this.participantCards.has(participantId)) {
            this.createParticipantCard(participantId);
        }
        
        const card = this.participantCards.get(participantId);
        this.updateCardContent(card, data);
    }

    createParticipantCard(participantId) {
        const card = document.createElement('div');
        card.className = 'dfd-participant-card';
        card.dataset.participantId = participantId;
        
        // Initial content
        card.innerHTML = `
            <div class="dfd-participant-header">
                <span class="dfd-participant-name">Loading...</span>
                <span class="dfd-participant-badge safe">REAL</span>
            </div>
            <div class="dfd-detection-grid">
                <div class="dfd-detection-item">
                    <div class="dfd-detection-label">Face</div>
                    <div class="dfd-detection-value face-safe">50%</div>
                </div>
                <div class="dfd-detection-item">
                    <div class="dfd-detection-label">Voice</div>
                    <div class="dfd-detection-value voice-safe">50%</div>
                </div>
                <div class="dfd-detection-item">
                    <div class="dfd-detection-label">Chat</div>
                    <div class="dfd-detection-value chat-safe">50%</div>
                </div>
            </div>
            <div class="dfd-confidence-container">
                <div class="dfd-confidence-label">
                    <span>Overall Confidence</span>
                    <span>50%</span>
                </div>
                <div class="dfd-confidence-bar">
                    <div class="dfd-confidence-fill face" style="width: 50%"></div>
                </div>
            </div>
        `;
        
        this.container.appendChild(card);
        this.participantCards.set(participantId, card);
    }

    updateCardContent(card, data) {
        // Update participant name if available
        if (data.participantName) {
            const nameEl = card.querySelector('.dfd-participant-name');
            if (nameEl) nameEl.textContent = data.participantName;
        }
        
        // Update detection values
        const faceValue = card.querySelector('.dfd-detection-value.face');
        const voiceValue = card.querySelector('.dfd-detection-value.voice');
        const chatValue = card.querySelector('.dfd-detection-value.chat');
        
        // Update based on data type
        if (data.type === 'video') {
            if (faceValue) {
                faceValue.textContent = `${(data.confidence * 100).toFixed(1)}%`;
                this.updateValueClass(faceValue, data.confidence);
            }
        } else if (data.type === 'audio') {
            if (voiceValue) {
                voiceValue.textContent = `${(data.confidence * 100).toFixed(1)}%`;
                this.updateValueClass(voiceValue, data.confidence);
            }
        } else if (data.type === 'chat') {
            if (chatValue) {
                chatValue.textContent = `${(data.confidence * 100).toFixed(1)}%`;
                this.updateValueClass(chatValue, data.confidence);
            }
        }
        
        // Calculate overall confidence
        const confidences = [];
        if (faceValue) confidences.push(parseFloat(faceValue.textContent));
        if (voiceValue) confidences.push(parseFloat(voiceValue.textContent));
        if (chatValue) confidences.push(parseFloat(chatValue.textContent));
        
        const overall = confidences.reduce((a, b) => a + b, 0) / confidences.length / 100;
        
        // Update confidence bar
        const bar = card.querySelector('.dfd-confidence-fill');
        const label = card.querySelector('.dfd-confidence-label span:last-child');
        
        if (bar) {
            bar.style.width = `${overall * 100}%`;
            this.updateBarClass(bar, overall);
        }
        
        if (label) {
            label.textContent = `${(overall * 100).toFixed(1)}%`;
        }
        
        // Update status badge
        const badge = card.querySelector('.dfd-participant-badge');
        if (badge) {
            this.updateBadge(badge, overall);
        }
        
        // Update card status
        this.updateCardStatus(card, overall);
    }

    updateValueClass(element, confidence) {
        element.classList.remove('face-safe', 'face-warning', 'face-danger',
                                'voice-safe', 'voice-warning', 'voice-danger',
                                'chat-safe', 'chat-warning', 'chat-danger');
        
        const prefix = element.classList[0]?.split('-')[0] || 'face';
        
        if (confidence > 0.8) {
            element.classList.add(`${prefix}-danger`);
        } else if (confidence > 0.6) {
            element.classList.add(`${prefix}-warning`);
        } else {
            element.classList.add(`${prefix}-safe`);
        }
    }

    updateBarClass(bar, confidence) {
        bar.classList.remove('face', 'voice', 'chat');
        
        if (confidence > 0.8) {
            bar.classList.add('face');
        } else if (confidence > 0.6) {
            bar.classList.add('voice');
        } else {
            bar.classList.add('chat');
        }
    }

    updateBadge(badge, confidence) {
        badge.classList.remove('safe', 'warning', 'danger');
        
        if (confidence > 0.8) {
            badge.classList.add('danger');
            badge.textContent = 'FAKE';
        } else if (confidence > 0.6) {
            badge.classList.add('warning');
            badge.textContent = 'SUSPICIOUS';
        } else {
            badge.classList.add('safe');
            badge.textContent = 'REAL';
        }
    }

    updateCardStatus(card, confidence) {
        card.classList.remove('status-safe', 'status-warning', 'status-danger');
        
        if (confidence > 0.8) {
            card.classList.add('status-danger');
        } else if (confidence > 0.6) {
            card.classList.add('status-warning');
        } else {
            card.classList.add('status-safe');
        }
    }

    // =========================================================
    // Chat Alerts
    // =========================================================

    showChatAlert(data) {
        if (!data.isAIGenerated) return;
        
        const alert = document.createElement('div');
        alert.className = `dfd-alert ${data.confidence > 0.8 ? '' : 'warning'}`;
        alert.innerHTML = `
            <h4>⚠️ AI-Generated Message Detected</h4>
            <p><strong>${data.sender}:</strong> "${data.text.substring(0, 100)}${data.text.length > 100 ? '...' : ''}"</p>
            <p>Confidence: ${(data.confidence * 100).toFixed(1)}%</p>
            <button onclick="this.parentElement.remove()">Dismiss</button>
        `;
        
        document.body.appendChild(alert);
        
        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (alert.parentElement) {
                alert.remove();
            }
        }, 10000);
    }

    // =========================================================
    // Settings
    // =========================================================

    async getSettings() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['dfd_settings'], (result) => {
                resolve(result.dfd_settings || {
                    theme: 'dark',
                    showOverlay: true
                });
            });
        });
    }

    applyTheme() {
        document.body.classList.remove('dfd-theme-dark', 'dfd-theme-light');
        document.body.classList.add(`dfd-theme-${this.theme}`);
    }

    // =========================================================
    // Controls
    // =========================================================

    show() {
        if (this.container) {
            this.container.style.display = 'block';
        }
        if (this.statusIndicator) {
            this.statusIndicator.style.display = 'flex';
        }
    }

    hide() {
        if (this.container) {
            this.container.style.display = 'none';
        }
        if (this.statusIndicator) {
            this.statusIndicator.style.display = 'none';
        }
    }

    remove() {
        if (this.container) {
            this.container.remove();
        }
        if (this.statusIndicator) {
            this.statusIndicator.remove();
        }
    }
}

// Export for use in content scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OverlayManager;
}
