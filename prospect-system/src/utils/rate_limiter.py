from __future__ import annotations

import time
from threading import Lock


class RateLimiter:
    """Token-bucket rate limiter to respect API limits."""

    def __init__(self, delay_ms: int = 1500) -> None:
        self._delay = delay_ms / 1000.0
        self._last_call: float = 0.0
        self._lock = Lock()

    def wait(self) -> None:
        with self._lock:
            now = time.monotonic()
            elapsed = now - self._last_call
            if elapsed < self._delay:
                time.sleep(self._delay - elapsed)
            self._last_call = time.monotonic()
