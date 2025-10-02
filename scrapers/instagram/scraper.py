#!/usr/bin/env python3
from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Optional

app = FastAPI(title="Instagram Scraper Placeholder")

class Video(BaseModel):
    id: str
    author: Optional[str] = None
    views: Optional[int] = None
    likes: Optional[int] = None
    durationSec: Optional[int] = None
    thumbnail: Optional[str] = None
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
            views=None,
            likes=100 + i,
            durationSec=15,
            thumbnail="https://via.placeholder.com/200x300",
            url=f"https://www.instagram.com/reel/C{100000+i}/"
        )
        items.append(v)
    return items

@app.get("/trends", response_model=List[Video])
def trends(hashtag: str = "viralreels", count: int = 5):
    # TODO: Replace with instaloader hashtag fetch
    return sample(count)

@app.get("/search", response_model=List[Video])
def search(q: str, count: int = 5):
    # TODO: Replace with search/hashtag logic
    return sample(count)
