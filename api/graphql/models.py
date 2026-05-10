#!/usr/bin/env python3
"""
GraphQL Models for Deepfake Defender Pro
Part 3.3

These models define the GraphQL schema types with built-in versioning support.
Following the principle: "Evolve APIs through additive changes"
"""

import strawberry
from typing import Optional, List, Dict, Any
from datetime import datetime
import enum
from strawberry.scalars import JSON


# =========================================================
# ENUMS (Version: 1.0.0 - NEVER CHANGE, ONLY ADD)
# =========================================================

@strawberry.enum
class DetectionResultType(enum.Enum):
    """Detection result types - ALWAYS additive"""
    REAL = "real"
    SUSPICIOUS = "suspicious"
    DEEPFAKE = "deepfake"
    UNKNOWN = "unknown"
    
    # Future versions: Add new values here, NEVER remove or rename existing ones


@strawberry.enum
class DetectorType(enum.Enum):
    """Available detector types"""
    MULTI_MODAL = "multi_modal"
    PHYSIOLOGICAL = "physiological"
    GAN_FINGERPRINT = "gan_fingerprint"
    ENF = "enf"
    BLOCKCHAIN = "blockchain"
    
    # Future: Add new detectors here (e.g., THERMAL, DEPTH)


@strawberry.enum
class PriorityLevel(enum.Enum):
    """Processing priority"""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    CRITICAL = "critical"


# =========================================================
# MAIN TYPES
# =========================================================

@strawberry.type
class DetectionResult:
    """Detection result with all fields"""
    request_id: str
    timestamp: str
    processing_time: float
    confidence: float
    is_deepfake: bool
    detectors_used: List[str]
    detailed_results: Optional[JSON] = None  # Changed from Dict[str, Any] to JSON


@strawberry.type
class ImageInfo:
    """Image metadata"""
    filename: str
    size: int
    dimensions: str
    format: str
    color_mode: Optional[str] = None


@strawberry.type
class ParticipantInfo:
    """Meeting participant information"""
    participant_id: str
    name: str
    meeting_id: str
    join_time: float
    last_active: float
    frame_count: int
    alert_count: int
    avg_confidence: float


@strawberry.type
class MeetingInfo:
    """Meeting information"""
    meeting_id: str
    created_at: float
    participants: List[ParticipantInfo]
    alerts: Optional[List['AlertInfo']] = None


@strawberry.type
class AlertInfo:
    """Alert information"""
    alert_id: str
    participant_id: str
    confidence: float
    message: str
    timestamp: float
    severity: str  # low, medium, high, critical


@strawberry.type
class DetectorStatus:
    """Detector health status"""
    name: str
    loaded: bool
    version: str
    last_active: Optional[float] = None


@strawberry.type
class SystemHealth:
    """System health information"""
    status: str
    version: str
    timestamp: str
    detectors: List[DetectorStatus]
    services: JSON  # Changed from Dict[str, bool] to JSON


# =========================================================
# INPUT TYPES (For mutations)
# =========================================================

@strawberry.input
class ImageDetectionInput:
    """Input for image detection"""
    file: Optional[str] = None  # base64 encoded
    url: Optional[str] = None
    return_features: bool = False
    priority: Optional[str] = "normal"
    metadata: Optional[JSON] = None  # Changed from Dict[str, Any] to JSON


@strawberry.input
class VideoDetectionInput:
    """Input for video detection"""
    file: Optional[str] = None  # base64 encoded
    url: Optional[str] = None
    analyze_frames: int = 30
    extract_audio: bool = True
    priority: Optional[str] = "normal"


@strawberry.input
class AudioDetectionInput:
    """Input for audio detection"""
    file: Optional[str] = None  # base64 encoded
    url: Optional[str] = None
    grid_region: Optional[str] = None
    priority: Optional[str] = "normal"


@strawberry.input
class MeetingJoinInput:
    """Input for joining a meeting"""
    meeting_id: str
    participant_id: Optional[str] = None
    name: Optional[str] = None
    token: str


@strawberry.input
class FrameInput:
    """Input for video frame"""
    participant_id: str
    data: str  # base64 encoded
    timestamp: Optional[float] = None
