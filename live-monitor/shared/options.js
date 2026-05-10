// Deepfake Defender - Options Script

document.addEventListener('DOMContentLoaded', loadSettings);

document.getElementById('saveBtn').addEventListener('click', saveSettings);
document.getElementById('testBtn').addEventListener('click', testConnection);

function loadSettings() {
    chrome.storage.local.get(['kaliIp', 'faceDetection', 'voiceDetection', 
                              'chatDetection', 'threshold', 'showOverlay', 'theme'], (result) => {
        document.getElementById('kali-ip').value = result.kaliIp || '192.168.152.128';
        document.getElementById('face-detection').checked = result.faceDetection !== false;
        document.getElementById('voice-detection').checked = result.voiceDetection !== false;
        document.getElementById('chat-detection').checked = result.chatDetection !== false;
        document.getElementById('threshold').value = result.threshold || '0.6';
        document.getElementById('show-overlay').checked = result.showOverlay !== false;
        document.getElementById('theme').value = result.theme || 'dark';
        document.getElementById('current-ip').textContent = result.kaliIp || '192.168.152.128';
    });
}

function saveSettings() {
    const settings = {
        kaliIp: document.getElementById('kali-ip').value,
        faceDetection: document.getElementById('face-detection').checked,
        voiceDetection: document.getElementById('voice-detection').checked,
        chatDetection: document.getElementById('chat-detection').checked,
        threshold: document.getElementById('threshold').value,
        showOverlay: document.getElementById('show-overlay').checked,
        theme: document.getElementById('theme').value
    };
    
    chrome.storage.local.set(settings, () => {
        showMessage('Settings saved successfully!', 'success');
        
        // Update any active content scripts
        chrome.tabs.query({url: 'https://meet.google.com/*'}, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, { type: 'settingsUpdated', settings });
            });
        });
    });
}

async function testConnection() {
    const ip = document.getElementById('kali-ip').value;
    const statusEl = document.getElementById('statusMessage');
    
    showMessage('Testing connection to Kali VM...', '');
    
    try {
        const response = await fetch(`http://${ip}:8000/health`);
        const data = await response.json();
        
        if (data.status === 'healthy') {
            showMessage(`✅ Connected to Kali VM! Version: ${data.version}`, 'success');
        } else {
            showMessage('❌ Connected but unexpected response', 'error');
        }
    } catch (error) {
        showMessage(`❌ Cannot connect to Kali VM at ${ip}:8000`, 'error');
    }
}

function showMessage(text, type) {
    const msgEl = document.getElementById('statusMessage');
    msgEl.textContent = text;
    msgEl.className = `status-message ${type}`;
    
    setTimeout(() => {
        msgEl.className = 'status-message';
    }, 3000);
}
