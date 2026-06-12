from __future__ import annotations

from abc import ABC, abstractmethod

from src.models.lead import LeadCreate


class BaseSource(ABC):
    """Abstract base for all data sources."""

    @property
    @abstractmethod
    def source_name(self) -> str:
        ...

    @abstractmethod
    def search(self, query: str, city: str, province: str = "", **kwargs) -> list[LeadCreate]:
        """Search for businesses matching query in the given location."""
        ...
