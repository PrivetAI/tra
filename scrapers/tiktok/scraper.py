#!/usr/bin/env python3
from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Optional

# NOTE: This is a placeholder API surface. Integration with TikTokApi should be added here.

app = FastAPI(title="TikTok Scraper Placeholder")

class Video(BaseModel):
    id: str
    author: Optional[str] = None
    views: Optional[int] = None
    likes: Optional[int] = None
    durationSec: Optional[int] = None
    cover: Optional[str] = None
    url: str

@app.get("/health")
def health():
    return {"ok": True}

def sample(count: int) -> List[Video]:
    items: List[Video] = []
    for i in range(count):
        v = Video(
            id=f"sample{i}",
            author="user",
            views=1000 + i,
            likes=100 + i,
            durationSec=15,
            cover="https://via.placeholder.com/200x300",
            url=f"https://www.tiktok.com/@user/video/{100000+i}"
        )
        items.append(v)
    return items

@app.get("/trends", response_model=List[Video])
def trends(count: int = 5):
    # TODO: Replace with TikTokApi trending fetch
    return sample(count)

@app.get("/search", response_model=List[Video])
def search(q: str, count: int = 5):
    # TODO: Replace with TikTokApi hashtag/keyword search
    return sample(count)
