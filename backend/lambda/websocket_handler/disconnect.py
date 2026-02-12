"""
WebSocket disconnect handler for API Gateway.

This is a minimal skeleton. Implement:
- Cleanup of connection state (e.g., remove connectionId from DynamoDB)
"""

from __future__ import annotations

from typing import Any, Dict


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
  """
  Lambda entrypoint for $disconnect route.
  """
  # TODO: Cleanup connection.
  return {
    "statusCode": 200,
    "body": "Disconnected.",
  }

