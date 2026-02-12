"""
WebSocket connect handler for API Gateway.

This is a minimal skeleton. Implement:
- Connection registration (e.g., store connectionId in DynamoDB)
- Authentication / authorization (if needed for MVP)
"""

from __future__ import annotations

from typing import Any, Dict


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
  """
  Lambda entrypoint for $connect route.
  """
  # TODO: Persist connection and perform any setup work.
  return {
    "statusCode": 200,
    "body": "Connected.",
  }

