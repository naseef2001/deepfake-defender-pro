/**
 * Deepfake Defender Live - Main Content Script
 * Orchestrates all detectors and overlay
 */

(function() {
    'use strict';

    console.log('🔍 Deepfake Defender Live: Content script loaded');

    // Import modules (in extension context)
    importScripts(
        '/js/detectors/api-client.js',
        '/js/content/video-detector.js',
        '/js/content/audio-detector.js',
        '/js/content/chat-detector.js',
        '/js/content/overlay.js'
    );

    // =========================================================
    // Main Controller
    // =========================================================

    class DeepfakeDefenderLive {
        constructor() {
            this.apiClient = null;
            this.videoDetector = null;
            this.audioDetector = null;
            this.chatDetector = null;
            this.overlayManager = null;
            this.initialized = false;
            this.meetingId = null;
            this.participantName = null;
        }

        async initialize() {
            console.log('🚀 Initializing Deepfake Defender Live...');
            
            // Detect platform and meeting ID
            this.detectMeeting();
            
            // Initialize API client
            this.apiClient = new DeepfakeAPIClient();
            
            // Initialize detectors
            this.videoDetector = new VideoDetector(this.apiClient);
            this.audioDetector = new AudioDetector(this.apiClient);
            this.chatDetector = new ChatDetector(this.apiClient);
            this.overlayManager = new OverlayManager();
            
            // Initialize all components
            await this.overlayManager.initialize();
            await this.videoDetector.initialize();
            await this.audioDetector.initialize();
            await this.chatDetector.initialize();
            
            // Connect to WebSocket
            await this.connectToServer();
            
            this.initialized = true;
            console.log('✅ Deepfake Defender Live initialized');
        }

        detectMeeting() {
            const hostname = window.location.hostname;
            
            if (hostname.includes('meet.google.com')) {
                this.detectGoogleMeet();
            } else if (hostname.includes('zoom.us')) {
                this.detectZoom();
            } else if (hostname.includes('teams.microsoft.com')) {
                this.detectTeams();
            }
        }

        detectGoogleMeet() {
            // Extract meeting ID from URL
            const urlParts = window.location.pathname.split('/');
            this.meetingId = urlParts[urlParts.length - 1];
            
            // Try to get participant name
            const nameElement = document.querySelector('[aria-label*="You"]');
            if (nameElement) {
                this.participantName = nameElement.getAttribute('aria-label');
            }
        }

        detectZoom() {
            // Extract meeting ID from URL
            const urlParams = new URLSearchParams(window.location.search);
            this.meetingId = urlParams.get('meeting_id') || 'zoom-meeting';
            
            // Try to get participant name
            const nameElement = document.querySelector('.participant-name');
            if (nameElement) {
                this.participantName = nameElement.textContent.trim();
            }
        }

        detectTeams() {
            // Extract meeting ID from URL
            this.meetingId = window.location.pathname.split('/').pop() || 'teams-meeting';
            
            // Try to get participant name
            const nameElement = document.querySelector('[data-tid="call-participant-name"]');
            if (nameElement) {
                this.participantName = nameElement.textContent.trim();
            }
        }

        async connectToServer() {
            if (!this.meetingId) {
                this.meetingId = 'unknown-meeting';
            }
            
            if (!this.participantName) {
                this.participantName = 'User';
            }
            
            try {
                await this.apiClient.connect(this.meetingId, this.participantName);
                console.log('✅ Connected to detection server');
            } catch (error) {
                console.error('❌ Failed to connect:', error);
            }
        }

        // =========================================================
        // Message Handling
        // =========================================================

        setupMessageListeners() {
            chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
                switch (request.type) {
                    case 'getStatus':
                        sendResponse(this.getStatus());
                        break;
                        
                    case 'updateSettings':
                        this.updateSettings(request.settings);
                        sendResponse({ success: true });
                        break;
                        
                    case 'joinMeeting':
                        this.connectToServer();
                        sendResponse({ success: true });
                        break;
                        
                    case 'leaveMeeting':
                        this.leaveMeeting();
                        sendResponse({ success: true });
                        break;
                }
            });
        }

        leaveMeeting() {
            if (this.apiClient) {
                this.apiClient.disconnect();
            }
            if (this.overlayManager) {
                this.overlayManager.hide();
            }
        }

        getStatus() {
            return {
                initialized: this.initialized,
                connected: this.apiClient?.isConnected() || false,
                meetingId: this.meetingId,
                participantName: this.participantName,
                stats: {
                    video: this.videoDetector?.getStats() || {},
                    audio: this.audioDetector?.getStats() || {},
                    chat: this.chatDetector?.getStats() || {}
                }
            };
        }

        async updateSettings(settings) {
            await this.apiClient.updateSettings(settings);
            
            if (settings.faceDetection === false) {
                this.videoDetector?.disable();
            } else {
                this.videoDetector?.enable();
            }
            
            if (settings.voiceDetection === false) {
                this.audioDetector?.disable();
            } else {
                this.audioDetector?.enable();
            }
            
            if (settings.chatDetection === false) {
                this.chatDetector?.disable();
            } else {
                this.chatDetector?.enable();
            }
        }
    }

    // =========================================================
    // Start
    // =========================================================

    // Wait for page to load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            const defender = new DeepfakeDefenderLive();
            defender.initialize();
        });
    } else {
        const defender = new DeepfakeDefenderLive();
        defender.initialize();
    }

})();
