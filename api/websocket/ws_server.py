#!/usr/bin/env python3
"""
WebSocket Server for Deepfake Defender Pro - ADVANCED VERSION
Complete with proper handshakes, SSL, and error handling
Now uses the trained model for real inference (93.12% accuracy)
"""

import os
import sys
import json
import asyncio
import logging
import ssl
import time
import base64
import uuid
from datetime import datetime
from typing import Dict, Set, Optional, Any

import numpy as np
import cv2
from PIL import Image
import io
import torch

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from src.core.multi_modal_transformer import MultiModalDeepfakeTransformer

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('websocket.log')
    ]
)
logger = logging.getLogger(__name__)

# =========================================================
# WEBSOCKET CONNECTION MANAGER
# =========================================================

class WebSocketManager:
    """Advanced WebSocket connection manager"""
    
    def __init__(self):
        self.active_connections: Dict[str, Any] = {}
        self.participants: Dict[str, dict] = {}
        self.meetings: Dict[str, set] = {}
        self.connection_count = 0
        self.total_messages = 0
        
    async def connect(self, websocket, participant_id: str, meeting_id: str):
        """Store a new connection"""
        self.active_connections[participant_id] = {
            'websocket': websocket,
            'connected_at': time.time(),
            'last_activity': time.time(),
            'message_count': 0
        }
        
        if meeting_id not in self.meetings:
            self.meetings[meeting_id] = set()
        self.meetings[meeting_id].add(participant_id)
        
        self.connection_count += 1
        logger.info(f"✅ Participant {participant_id} connected to meeting {meeting_id}")
        logger.info(f"📊 Total connections: {self.connection_count}")
        
    def disconnect(self, participant_id: str):
        """Remove a connection"""
        if participant_id in self.active_connections:
            # Get meeting info before removal
            meeting_id = None
            if participant_id in self.participants:
                meeting_id = self.participants[participant_id].get('meeting_id')
            
            # Remove from active connections
            del self.active_connections[participant_id]
            
            # Remove from participants
            if participant_id in self.participants:
                del self.participants[participant_id]
            
            # Remove from meeting
            if meeting_id and meeting_id in self.meetings:
                self.meetings[meeting_id].discard(participant_id)
                if not self.meetings[meeting_id]:
                    del self.meetings[meeting_id]
            
            self.connection_count -= 1
            logger.info(f"❌ Participant {participant_id} disconnected")
            logger.info(f"📊 Total connections: {self.connection_count}")
    
    async def send_message(self, participant_id: str, message: dict) -> bool:
        """Send message to specific participant"""
        if participant_id not in self.active_connections:
            return False
        
        try:
            websocket = self.active_connections[participant_id]['websocket']
            await websocket.send_json(message)
            self.active_connections[participant_id]['last_activity'] = time.time()
            self.active_connections[participant_id]['message_count'] += 1
            self.total_messages += 1
            return True
        except Exception as e:
            logger.error(f"Failed to send to {participant_id}: {e}")
            return False
    
    def get_stats(self) -> dict:
        """Get connection statistics"""
        return {
            'active_connections': len(self.active_connections),
            'active_meetings': len(self.meetings),
            'total_messages': self.total_messages,
            'connection_count': self.connection_count,
            'participants': list(self.participants.keys()),
            'meetings': list(self.meetings.keys())
        }

# Global manager instance
manager = WebSocketManager()

# =========================================================
# FASTAPI APPLICATION
# =========================================================

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

app = FastAPI(
    title="Deepfake Defender WebSocket Server",
    description="Advanced WSS server for real-time deepfake detection",
    version="3.2.0"
)

# Add CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================================================
# LOAD TRAINED MODEL
# =========================================================
device = torch.device('cpu')
model = MultiModalDeepfakeTransformer()
model.model.eval()
weights_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "models", "best_model.pth")
if os.path.exists(weights_path):
    state_dict = torch.load(weights_path, map_location=device)
    model.model.load_state_dict(state_dict)
    logger.info(f"✅ Loaded trained weights from {weights_path}")
else:
    logger.warning(f"⚠️ Model weights not found at {weights_path}")

# =========================================================
# HTTP ENDPOINTS
# =========================================================

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "Deepfake Defender WebSocket Server",
        "version": "3.2.0",
        "status": "running",
        "endpoints": {
            "websocket": "/ws/meeting",
            "health": "/health",
            "stats": "/stats"
        },
        "timestamp": datetime.now().isoformat()
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "WebSocket Server",
        "version": "3.2.0",
        "timestamp": datetime.now().isoformat(),
        "active_connections": len(manager.active_connections),
        "active_meetings": len(manager.meetings)
    }

@app.get("/stats")
async def get_stats():
    """Get detailed statistics"""
    return manager.get_stats()

# =========================================================
# WEBSOCKET ENDPOINT - WITH REAL MODEL INFERENCE
# =========================================================

@app.websocket("/ws/meeting")
async def websocket_endpoint(websocket: WebSocket):
    """Main WebSocket endpoint with proper handshake"""
    
    client_host = websocket.client.host if websocket.client else "unknown"
    participant_id = None
    meeting_id = None
    
    try:
        # STEP 1: Accept the connection FIRST (critical!)
        await websocket.accept()
        logger.info(f"🔌 WebSocket connection accepted from {client_host}")
        
        # STEP 2: Wait for join message with timeout
        try:
            data = await asyncio.wait_for(websocket.receive_json(), timeout=10.0)
        except asyncio.TimeoutError:
            logger.warning(f"⏰ Timeout waiting for join message from {client_host}")
            await websocket.close(code=1002)
            return
        
        # STEP 3: Process join message
        if data.get('type') == 'join':
            participant_id = data.get('participant_id', f"user_{uuid.uuid4().hex[:8]}")
            meeting_id = data.get('meeting_id', 'default-meeting')
            participant_name = data.get('name', 'Anonymous')
            
            # Store participant info
            manager.participants[participant_id] = {
                'id': participant_id,
                'name': participant_name,
                'meeting_id': meeting_id,
                'client_host': client_host,
                'connected_at': datetime.now().isoformat(),
                'frame_count': 0,
                'alert_count': 0
            }
            
            # Register with manager
            await manager.connect(websocket, participant_id, meeting_id)
            
            # Send join confirmation
            await manager.send_message(participant_id, {
                'type': 'join_confirmed',
                'participant_id': participant_id,
                'meeting_id': meeting_id,
                'name': participant_name,
                'timestamp': time.time()
            })
            
            logger.info(f"✅ Participant {participant_name} ({participant_id}) joined meeting {meeting_id}")
            
            # STEP 4: Main message loop
            while True:
                try:
                    # Receive message with timeout
                    message = await asyncio.wait_for(websocket.receive_json(), timeout=30.0)
                    
                    # Update activity
                    if participant_id in manager.active_connections:
                        manager.active_connections[participant_id]['last_activity'] = time.time()
                    
                    # Handle different message types
                    msg_type = message.get('type')
                    
                    if msg_type == 'frame':
                        # Process video frame
                        participant = manager.participants.get(participant_id)
                        if participant:
                            participant['frame_count'] += 1
                            
                            # ---- REAL MODEL INFERENCE ----
                            try:
                                # Decode base64 image
                                img_bytes = base64.b64decode(message['data'])
                                img = Image.open(io.BytesIO(img_bytes)).convert('RGB')
                                img = img.resize((112, 112))
                                img_array = np.array(img) / 255.0  # normalize to [0,1]

                                # Create 16 identical frames (model expects 16 frames)
                                frames = np.stack([img_array] * 16)  # (16, 112, 112, 3)
                                video_tensor = torch.FloatTensor(frames).unsqueeze(0)  # (1, 16, 112, 112, 3)

                                # Run inference
                                with torch.no_grad():
                                    result = model(video=video_tensor)  # returns DetectionResult

                                confidence = float(result.confidence)          # fake probability
                                is_deepfake = bool(result.is_deepfake)

                                # LOG THE CONFIDENCE (new line added)
                                logger.info(f"🔍 Inference confidence for {participant_id}: {confidence:.3f}")

                                # Send analysis result
                                await manager.send_message(participant_id, {
                                    'type': 'analysis',
                                    'participant_id': participant_id,
                                    'confidence': confidence,
                                    'is_deepfake': is_deepfake,
                                    'frame_count': participant['frame_count'],
                                    'timestamp': time.time()
                                })

                                logger.debug(f"📊 Frame analyzed for {participant_id}: confidence={confidence:.2f}")

                                # Send alert if deepfake detected
                                if is_deepfake:
                                    participant['alert_count'] += 1
                                    await manager.send_message(participant_id, {
                                        'type': 'alert',
                                        'severity': 'high',
                                        'message': f"⚠️ Deepfake detected with {confidence*100:.0f}% confidence!",
                                        'confidence': confidence,
                                        'timestamp': time.time()
                                    })
                            except Exception as e:
                                logger.error(f"❌ Frame processing error: {e}")
                    
                    elif msg_type == 'ping':
                        await manager.send_message(participant_id, {
                            'type': 'pong',
                            'timestamp': time.time()
                        })
                    
                    elif msg_type == 'get_stats':
                        await manager.send_message(participant_id, {
                            'type': 'stats',
                            'stats': manager.get_stats(),
                            'timestamp': time.time()
                        })
                    
                    else:
                        logger.warning(f"Unknown message type: {msg_type} from {participant_id}")
                        
                except asyncio.TimeoutError:
                    # Send keepalive ping
                    try:
                        await manager.send_message(participant_id, {
                            'type': 'ping',
                            'timestamp': time.time()
                        })
                    except:
                        break
                        
                except WebSocketDisconnect:
                    logger.info(f"WebSocket disconnected for {participant_id}")
                    break
                    
                except json.JSONDecodeError:
                    logger.warning(f"Invalid JSON from {participant_id}")
                    continue
                    
        else:
            logger.warning(f"Invalid first message type: {data.get('type')} from {client_host}")
            await websocket.close(code=1002)
            
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for {participant_id}")
    except Exception as e:
        logger.error(f"WebSocket error for {participant_id}: {e}", exc_info=True)
    finally:
        if participant_id:
            manager.disconnect(participant_id)

# =========================================================
# MAIN ENTRY POINT
# =========================================================

if __name__ == "__main__":
    # SSL Certificate paths
    cert_file = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "certs", "cert.pem")
    key_file = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "certs", "key.pem")
    
    # Server configuration
    config = {
        "host": "0.0.0.0",
        "port": 8001,
        "reload": False,
        "log_level": "info",
        "workers": 1
    }
    
    # Add SSL if certificates exist
    ssl_status = "DISABLED"
    if os.path.exists(cert_file) and os.path.exists(key_file):
        config.update({
            "ssl_keyfile": key_file,
            "ssl_certfile": cert_file
        })
        ssl_status = "ENABLED"
    
    # Print startup banner
    print("\n" + "="*70)
    print("🚀 DEEPFAKE DEFENDER WEBSOCKET SERVER v3.2.0 (with REAL MODEL)")
    print("="*70)
    print(f"\n📡 WebSocket endpoint: {'wss' if ssl_status == 'ENABLED' else 'ws'}://localhost:8001/ws/meeting")
    print(f"🔒 SSL/WSS: {ssl_status}")
    print(f"🔍 Health check: http://localhost:8001/health")
    print(f"📊 Stats: http://localhost:8001/stats")
    print(f"\n✅ Server starting on port 8001...")
    print("="*70)
    
    # Run server
    uvicorn.run(
        "api.websocket.ws_server:app",
        **config
    )
