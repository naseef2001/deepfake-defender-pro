// Deepfake Defender - Content Script
console.log('%c🔥 DEEPFAKE DEFENDER: ACTIVATED!', 'background: #ff0000; color: white; font-size: 20px; padding: 10px;');

// Configuration
const KALI_IP = '192.168.152.128';
const API_URL = `http://${KALI_IP}:8000`;
const WS_URL = `ws://${KALI_IP}:8001/ws/meeting`;

(function() {
    'use strict';
    
    console.log('✅ Content script initializing...');
    console.log('🔧 Kali IP:', KALI_IP);

    // Add visible indicator to the page
    function addIndicator() {
        if (document.getElementById('dfd-indicator')) return;
        
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
        indicator.onclick = showDetailedStatus;
        
        updateIndicatorStatus('connecting');
        document.body.appendChild(indicator);
        console.log('✅ Indicator added');
    }

    function updateIndicatorStatus(status) {
        const indicator = document.getElementById('dfd-indicator');
        if (!indicator) return;

        const icons = {
            connected: '🛡️',
            connecting: '🔄',
            error: '⚠️'
        };

        const colors = {
            connected: '#00ff00',
            connecting: '#ffaa00',
            error: '#ff4444'
        };

        const texts = {
            connected: 'Connected to Kali',
            connecting: 'Connecting...',
            error: 'Kali Offline'
        };

        indicator.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 20px;">${icons[status] || '🛡️'}</span>
                <div>
                    <div style="font-size: 14px;">Deepfake Defender</div>
                    <div style="font-size: 11px; opacity: 0.9;">${texts[status] || 'Unknown'}</div>
                </div>
                <span style="width: 10px; height: 10px; background: ${colors[status] || '#888'}; border-radius: 50%;"></span>
            </div>
        `;
    }

    function showDetailedStatus() {
        const statusDiv = document.createElement('div');
        statusDiv.id = 'dfd-status-popup';
        statusDiv.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            background: rgba(0,0,0,0.95);
            color: white;
            padding: 25px;
            border-radius: 15px;
            z-index: 1000000;
            font-family: Arial, sans-serif;
            min-width: 320px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.5);
            border-left: 5px solid #667eea;
            backdrop-filter: blur(10px);
        `;
        
        statusDiv.innerHTML = `
            <h3 style="margin:0 0 20px 0; color:#667eea; font-size: 18px;">🛡️ Deepfake Defender Status</h3>
            <div style="margin:12px 0; display: flex; justify-content: space-between;">
                <span style="opacity:0.7;">Kali VM IP:</span>
                <span style="font-family: monospace;">${KALI_IP}</span>
            </div>
            <div style="margin:12px 0; display: flex; justify-content: space-between;">
                <span style="opacity:0.7;">Meeting ID:</span>
                <span style="font-family: monospace;">${getMeetingInfo().meetingId}</span>
            </div>
            <div style="margin:12px 0; display: flex; justify-content: space-between;">
                <span style="opacity:0.7;">Participant:</span>
                <span>${getMeetingInfo().participantName}</span>
            </div>
            <div style="margin:20px 0; height:1px; background: rgba(255,255,255,0.1);"></div>
            <div style="margin:12px 0; display: flex; justify-content: space-between;">
                <span>REST API:</span>
                <span id="api-status">⏳ Checking...</span>
            </div>
            <div style="margin:12px 0; display: flex; justify-content: space-between;">
                <span>WebSocket:</span>
                <span id="ws-status">⏳ Checking...</span>
            </div>
            <button onclick="this.parentElement.remove()" style="background:#667eea; color:white; border:none; padding:12px 20px; border-radius:8px; width:100%; margin-top:20px; cursor:pointer; font-weight:bold;">Close</button>
        `;
        
        document.body.appendChild(statusDiv);
        
        // Check API
        fetch(`${API_URL}/health`)
            .then(r => r.json())
            .then(() => {
                document.getElementById('api-status').innerHTML = '✅ Online';
                document.getElementById('api-status').style.color = '#00ff00';
            })
            .catch(() => {
                document.getElementById('api-status').innerHTML = '❌ Offline';
                document.getElementById('api-status').style.color = '#ff4444';
            });
            
        // Check WebSocket
        try {
            const ws = new WebSocket(WS_URL);
            ws.onopen = () => {
                document.getElementById('ws-status').innerHTML = '✅ Online';
                document.getElementById('ws-status').style.color = '#00ff00';
                ws.close();
            };
            ws.onerror = () => {
                document.getElementById('ws-status').innerHTML = '❌ Offline';
                document.getElementById('ws-status').style.color = '#ff4444';
            };
        } catch (e) {
            document.getElementById('ws-status').innerHTML = '❌ Offline';
            document.getElementById('ws-status').style.color = '#ff4444';
        }
    }

    function getMeetingInfo() {
        const url = window.location.href;
        const meetingId = url.includes('/') ? url.split('/').pop() : 'unknown';
        let participantName = 'Unknown';
        const nameElement = document.querySelector('[aria-label*="You"]');
        if (nameElement) {
            participantName = nameElement.getAttribute('aria-label') || 'User';
        }
        return { meetingId, participantName };
    }

    async function testKaliConnection() {
        try {
            const response = await fetch(`${API_URL}/health`);
            const data = await response.json();
            console.log('✅ Connected to Kali:', data);
            updateIndicatorStatus('connected');
            return true;
        } catch (error) {
            console.error('❌ Kali offline:', error.message);
            updateIndicatorStatus('error');
            return false;
        }
    }

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.type === 'ping') {
            testKaliConnection().then(connected => {
                sendResponse({ 
                    status: 'alive', 
                    meeting: getMeetingInfo(),
                    kaliConnected: connected
                });
            });
            return true;
        }
    });

    async function init() {
        addIndicator();
        console.log('📹 Meeting:', getMeetingInfo().meetingId);
        await testKaliConnection();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
