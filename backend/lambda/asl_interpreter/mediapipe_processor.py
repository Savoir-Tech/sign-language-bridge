"""
MediaPipe / OpenCV-based pre-processing for ASL video frames.

This module should:
- Extract hand landmarks, pose, and relevant features
- Package them into a format Nova 2 Sonic can understand
"""

from __future__ import annotations

from typing import Any, Dict, List


class MediaPipeProcessor:
  """
  Placeholder processor; integrate real MediaPipe pipeline later.
  """

  def __init__(self) -> None:
    # TODO: Initialize MediaPipe graphs / OpenCV configuration.
    pass

  def process_frames(self, frames: List[bytes]) -> Dict[str, Any]:
    """
    Accepts a list of raw video frames (e.g., bytes) and returns feature data.
    """
    # TODO: Implement frame decoding and landmark extraction.
    raise NotImplementedError("MediaPipeProcessor.process_frames is not implemented yet.")

