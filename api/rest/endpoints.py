#!/usr/bin/env python3
"""
REST API for Deepfake Defender Pro - HTTPS ENABLED
"""

import os
import sys
import json
import time
import asyncio
import hashlib
import tempfile
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from pathlib import Path
import logging
from contextlib import asynccontextmanager

import numpy as np
import cv2
import librosa
import torch
import torch.nn.functional as F

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Depends, status, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware
from pydantic import BaseModel
import uvicorn

# Import detectors
try:
    from src.core.multi_modal_transformer import MultiModalDeepfakeTransformer
    from src.detectors.physiological_detector import PhysiologicalSignalDetector
    from src.detectors.gan_fingerprint import GANFingerprintAnalyzer
    from src.analyzers.enf_analyzer import ENFAnalyzer
    DETECTORS_AVAILABLE = True
except ImportError as e:
    DETECTORS_AVAILABLE = False
    print(f"Warning: Detectors not loaded: {e}")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# =========================================================
# MODELS
# =========================================================

class HealthResponse(BaseModel):
    status: str
    version: str
    timestamp: str
    detectors: Dict[str, bool]

class DetectionResponse(BaseModel):
    request_id: str
    timestamp: str
    processing_time: float
    confidence: float
    is_deepfake: bool
    detectors_used: List[str]

class Token(BaseModel):
    access_token: str
    token_type: str
    expires_in: int

# =========================================================
# AUTHENTICATION
# =========================================================

fake_users_db = {
    "admin": {
        "username": "admin",
        "hashed_password": "secret",
        "disabled": False
    }
}

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token", auto_error=False)

def authenticate_user(username: str, password: str) -> bool:
    return username == "admin" and password == "secret"

def create_access_token():
    return hashlib.sha256(f"{time.time()}".encode()).hexdigest()

# =========================================================
# PREPROCESSING FUNCTIONS (copied from training script)
# =========================================================

def extract_frames(video_path, num_frames=16, frame_size=(112, 112)):
    """Extract frames from video with consistent count"""
    cap = cv2.VideoCapture(video_path)
    frames = []
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    if total <= 0:
        cap.release()
        return np.zeros((num_frames, frame_size[0], frame_size[1], 3))
    
    # Sample uniformly
    indices = np.linspace(0, max(total-1, 1), num_frames, dtype=int)
    
    for i in indices:
        cap.set(cv2.CAP_PROP_POS_FRAMES, i)
        ret, frame = cap.read()
        if ret:
            frame = cv2.resize(frame, frame_size)
            frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            frames.append(frame)
        else:
            frames.append(np.zeros((frame_size[0], frame_size[1], 3)))
    
    cap.release()
    
    # Ensure we have exactly num_frames
    if len(frames) < num_frames:
        while len(frames) < num_frames:
            frames.append(np.zeros((frame_size[0], frame_size[1], 3)))
    elif len(frames) > num_frames:
        frames = frames[:num_frames]
    
    return np.array(frames) / 255.0

def extract_audio(audio_path, sr=16000, duration=4, n_mfcc=13, target_frames=216):
    """Extract audio features with consistent length"""
    try:
        audio, _ = librosa.load(audio_path, sr=sr, duration=duration)
        mfcc = librosa.feature.mfcc(y=audio, sr=sr, n_mfcc=n_mfcc)
        
        if mfcc.shape[1] < target_frames:
            padding = target_frames - mfcc.shape[1]
            mfcc = np.pad(mfcc, ((0, 0), (0, padding)), mode='constant')
        elif mfcc.shape[1] > target_frames:
            mfcc = mfcc[:, :target_frames]
        
        return mfcc
    except:
        return np.zeros((n_mfcc, target_frames))

# =========================================================
# DETECTOR MANAGER
# =========================================================

class DetectorManager:
    def __init__(self):
        self.detectors = {}
        self.load_detectors()
    
    def load_detectors(self):
        if DETECTORS_AVAILABLE:
            # ----- Multi-Modal Detector (with trained weights) -----
            try:
                self.detectors['multi_modal'] = MultiModalDeepfakeTransformer()
                logger.info("✅ Multi-Modal loaded")
                
                # Load trained weights
                weights_path = 'models/best_model.pth'
                if os.path.exists(weights_path):
                    state_dict = torch.load(weights_path, map_location='cpu')
                    self.detectors['multi_modal'].model.load_state_dict(state_dict)
                    logger.info(f"✅ Loaded trained weights from {weights_path}")
                else:
                    logger.warning(f"⚠️ Weights not found at {weights_path}")
            except Exception as e:
                logger.error(f"❌ Failed to load Multi-Modal: {e}")
            
            # ----- Physiological Detector -----
            try:
                self.detectors['physiological'] = PhysiologicalSignalDetector()
                logger.info("✅ Physiological loaded")
            except Exception as e:
                logger.error(f"Failed: {e}")
            
            # ----- GAN Fingerprint Detector -----
            try:
                self.detectors['gan'] = GANFingerprintAnalyzer()
                logger.info("✅ GAN loaded")
            except Exception as e:
                logger.error(f"Failed: {e}")
            
            # ----- ENF Analyzer -----
            try:
                self.detectors['enf'] = ENFAnalyzer()
                logger.info("✅ ENF loaded")
            except Exception as e:
                logger.error(f"Failed: {e}")
    
    def get_all_detectors(self):
        return list(self.detectors.keys())

detector_manager = DetectorManager()

# =========================================================
# FASTAPI APP
# =========================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("=" * 60)
    logger.info("🚀 Starting Deepfake Defender API with HTTPS")
    logger.info("=" * 60)
    logger.info(f"Detectors: {detector_manager.get_all_detectors()}")
    yield
    logger.info("Shutting down...")

app = FastAPI(
    title="Deepfake Defender API",
    version="3.1.0",
    lifespan=lifespan
)

# Add HTTPS redirect
app.add_middleware(HTTPSRedirectMiddleware)

# Add CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================================================
# ENDPOINTS
# =========================================================

@app.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(
        status="healthy",
        version="3.1.0",
        timestamp=datetime.now().isoformat(),
        detectors={name: True for name in detector_manager.get_all_detectors()}
    )

@app.post("/token", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    if not authenticate_user(form_data.username, form_data.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    return Token(
        access_token=create_access_token(),
        token_type="bearer",
        expires_in=3600
    )

@app.post("/detect/image", response_model=DetectionResponse)
async def detect_image(file: UploadFile = File(...)):
    request_id = hashlib.md5(f"{time.time()}{os.urandom(8)}".encode()).hexdigest()[:16]
    start_time = time.time()
    
    # Save uploaded file temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name
    
    try:
        # Extract video frames and audio features
        frames = extract_frames(tmp_path)
        audio_features = extract_audio(tmp_path)
        
        # Convert to tensors with batch dimension
        video_tensor = torch.FloatTensor(frames).unsqueeze(0)  # (1, 16, 112, 112, 3)
        audio_tensor = torch.FloatTensor(audio_features).unsqueeze(0)  # (1, 13, 216)
        
        # Get detector
        detector = detector_manager.detectors.get('multi_modal')
        if detector is None:
            raise HTTPException(status_code=500, detail="Multi-modal detector not available")
        
        # Run inference
        with torch.no_grad():
            result = detector(video=video_tensor, audio=audio_tensor)
        
        # Extract confidence and decision
        confidence = result.confidence
        is_deepfake = result.is_deepfake
        # result.confidence is the fake probability; is_deepfake is bool
        
    except Exception as e:
        logger.error(f"Detection error: {e}")
        raise HTTPException(status_code=500, detail=f"Detection failed: {str(e)}")
    finally:
        # Clean up temp file
        os.unlink(tmp_path)
    
    return DetectionResponse(
        request_id=request_id,
        timestamp=datetime.now().isoformat(),
        processing_time=time.time() - start_time,
        confidence=confidence,
        is_deepfake=is_deepfake,
        detectors_used=["multi_modal"]
    )

@app.get("/")
async def root():
    return {
        "service": "Deepfake Defender API",
        "version": "3.1.0",
        "https": True,
        "status": "running"
    }

# =========================================================
# MAIN
# =========================================================

if __name__ == "__main__":
    # Check certificates
    cert_file = "certs/cert.pem"
    key_file = "certs/key.pem"
    
    if os.path.exists(cert_file) and os.path.exists(key_file):
        print("\n🔒 HTTPS mode enabled")
        uvicorn.run(
            "api.rest.endpoints:app",
            host="0.0.0.0",
            port=8000,
            ssl_keyfile=key_file,
            ssl_certfile=cert_file,
            reload=True
        )
    else:
        print("\n⚠  Certificates not found. Generate with:")
        print("   mkdir -p certs && cd certs")
        print("   openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes")
        uvicorn.run(
            "api.rest.endpoints:app",
            host="0.0.0.0",
            port=8000,
            reload=True
        )
