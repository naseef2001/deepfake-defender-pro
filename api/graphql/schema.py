#!/usr/bin/env python3
"""
Main GraphQL Schema for Deepfake Defender Pro
Part 3.3

This file defines the complete GraphQL schema with:
- Queries (read operations)
- Mutations (write operations)
"""

import strawberry
from typing import List, Optional, Dict, Any
from strawberry.fastapi import GraphQLRouter
from strawberry.scalars import JSON

from . import models
from . import resolvers


# =========================================================
# QUERIES (Read Operations)
# =========================================================

@strawberry.type
class Query:
    """GraphQL Queries - All read operations"""
    
    # ===== Version =====
    @strawberry.field
    async def version(self) -> str:
        """Get API version"""
        return "3.3.0"
    
    # ===== Detection Queries =====
    @strawberry.field
    async def detect_image(
        self,
        input: models.ImageDetectionInput,
        token: Optional[str] = None
    ) -> models.DetectionResult:
        """Detect deepfakes in an image"""
        return await resolvers.resolve_detect_image(input, token)
    
    @strawberry.field
    async def detect_video(
        self,
        input: models.VideoDetectionInput,
        token: Optional[str] = None
    ) -> models.DetectionResult:
        """Detect deepfakes in a video"""
        return await resolvers.resolve_detect_video(input, token)
    
    @strawberry.field
    async def detect_audio(
        self,
        input: models.AudioDetectionInput,
        token: Optional[str] = None
    ) -> models.DetectionResult:
        """Detect deepfakes in audio"""
        return await resolvers.resolve_detect_audio(input, token)
    
    # ===== Meeting Queries =====
    @strawberry.field
    async def get_meeting(
        self,
        meeting_id: str,
        token: Optional[str] = None
    ) -> Optional[models.MeetingInfo]:
        """Get information about a specific meeting"""
        return await resolvers.resolve_get_meeting(meeting_id, token)
    
    @strawberry.field
    async def list_meetings(
        self,
        token: Optional[str] = None
    ) -> List[models.MeetingInfo]:
        """List all active meetings"""
        return await resolvers.resolve_list_meetings(token)
    
    # ===== System Queries =====
    @strawberry.field
    async def health(
        self,
        token: Optional[str] = None
    ) -> models.SystemHealth:
        """Get system health status"""
        return await resolvers.resolve_health(token)
    
    @strawberry.field
    async def stats(
        self,
        token: Optional[str] = None
    ) -> JSON:  # Changed from Dict[str, Any] to JSON
        """Get system statistics"""
        return await resolvers.resolve_stats(token)


# =========================================================
# MUTATIONS (Write Operations)
# =========================================================

@strawberry.type
class Mutation:
    """GraphQL Mutations - All write operations"""
    
    # ===== Authentication =====
    @strawberry.mutation
    async def login(
        self,
        username: str,
        password: str
    ) -> str:
        """Get authentication token"""
        return await resolvers.get_token(username, password)
    
    # ===== Detection Mutations =====
    @strawberry.mutation
    async def submit_image(
        self,
        input: models.ImageDetectionInput,
        token: Optional[str] = None
    ) -> models.DetectionResult:
        """Submit an image for detection"""
        return await resolvers.resolve_detect_image(input, token)
    
    @strawberry.mutation
    async def submit_video(
        self,
        input: models.VideoDetectionInput,
        token: Optional[str] = None
    ) -> models.DetectionResult:
        """Submit a video for detection"""
        return await resolvers.resolve_detect_video(input, token)
    
    @strawberry.mutation
    async def submit_audio(
        self,
        input: models.AudioDetectionInput,
        token: Optional[str] = None
    ) -> models.DetectionResult:
        """Submit audio for detection"""
        return await resolvers.resolve_detect_audio(input, token)


# =========================================================
# CREATE SCHEMA
# =========================================================

schema = strawberry.Schema(query=Query, mutation=Mutation)


# =========================================================
# VERSIONING INFORMATION
# =========================================================

SCHEMA_VERSION = "3.3.0"
VERSION_HISTORY = [
    {
        "version": "1.0.0",
        "date": "2024-01-01",
        "changes": "Initial release - Basic detection queries"
    },
    {
        "version": "2.0.0",
        "date": "2024-06-01",
        "changes": "Added meeting management, detailed results"
    },
    {
        "version": "3.0.0",
        "date": "2025-01-01",
        "changes": "Added mutations, improved error handling"
    },
    {
        "version": "3.3.0",
        "date": "2026-02-25",
        "changes": "Current version - Full GraphQL implementation"
    }
]

def get_schema_info():
    """Get schema version information"""
    return {
        "current_version": SCHEMA_VERSION,
        "history": VERSION_HISTORY,
        "total_queries": len(dir(Query)),
        "total_mutations": len(dir(Mutation))
    }
