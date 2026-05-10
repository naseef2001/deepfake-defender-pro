// Deepfake Defender - Popup Script

document.addEventListener('DOMContentLoaded', function() {
    updateStatus();
    
    document.getElementById('refreshBtn').addEventListener('click', updateStatus);
    document.getElementById('settingsBtn').addEventListener('click', openSettings);
});

async function updateStatus() {
    const statusEl = document.getElementById('kali-status');
    const meetingEl = document.getElementById('meeting-id');
    const participantEl = document.getElementById('participant-name');
    
    statusEl.innerHTML = '<span class="loader"></span> Checking...';
    
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab.url.includes('meet.google.com')) {
            statusEl.innerHTML = '❌ Not in Google Meet';
            meetingEl.textContent = '-';
            participantEl.textContent = '-';
            return;
        }
        
        const response = await chrome.tabs.sendMessage(tab.id, { type: 'ping' });
        
        if (response && response.status === 'alive') {
            statusEl.innerHTML = response.kaliConnected ? 
                '<span class="dot green"></span> Connected' : 
                '<span class="dot red"></span> Offline';
            meetingEl.textContent = response.meeting.meetingId;
            participantEl.textContent = response.meeting.participantName;
        } else {
            statusEl.innerHTML = '⚠️ No response';
        }
    } catch (error) {
        console.error('Popup error:', error);
        statusEl.innerHTML = '❌ Error loading';
        meetingEl.textContent = '-';
        participantEl.textContent = '-';
    }
}

function openSettings() {
    chrome.runtime.openOptionsPage();
}
