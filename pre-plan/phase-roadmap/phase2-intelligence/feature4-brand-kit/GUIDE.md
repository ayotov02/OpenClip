# Brand Kit System — Implementation Guide

## Overview
- **What:** CRUD system for brand kits (logos, colors, fonts, intros, outros, caption styles) that auto-apply to generated clips.
- **Why:** Consistent branding across all clips. Brand kits save creators from manually applying logos and styles every time.
- **Dependencies:** Phase 1 Feature 2 (FastAPI Backend), Phase 1 Feature 4 (Video Processing)

## Architecture

### Data Model
```sql
BrandKit
  - id: UUID (PK)
  - user_id: FK(User)
  - name: string
  - config: JSON
    - logos: { light: GCS path, dark: GCS path, position, opacity }
    - colors: { primary, secondary, accent, caption_highlight, caption_bg }
    - fonts: { heading: GCS path, body: GCS path, caption: GCS path }
    - intro_video: GCS path (max 60s)
    - outro_video: GCS path (max 60s)
    - caption_style: { animation, max_words, position, emoji }
    - thumbnail_template: { layout, text_font, text_color }
  - is_default: boolean
  - created_at: timestamp
  - updated_at: timestamp
```

### Application Flow
```
Generate Clip → Fetch user's default BrandKit
  → Overlay logo (FFmpeg drawtext/overlay filter)
  → Prepend intro video (FFmpeg concat)
  → Append outro video (FFmpeg concat)
  → Apply caption style (font, colors from brand kit)
  → Generate thumbnail with brand colors/fonts
```

## Step-by-Step Implementation

### Step 1: Create BrandKit Model
Create `backend/app/models/brand_kit.py`:
```python
from sqlalchemy import String, JSON, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import BaseModel

class BrandKit(BaseModel):
    __tablename__ = "brand_kits"
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    name: Mapped[str] = mapped_column(String(255))
    config: Mapped[dict] = mapped_column(JSON, default=dict)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    user = relationship("User", back_populates="brand_kits")
```

### Step 2: Create CRUD API
Create `backend/app/api/v1/brands.py`:
```python
from fastapi import APIRouter, Depends, File, UploadFile
from app.core.deps import get_current_user

router = APIRouter()

@router.get("/")
async def list_brand_kits(user=Depends(get_current_user), db=Depends(get_db)):
    result = await db.execute(select(BrandKit).where(BrandKit.user_id == user.id))
    return {"brand_kits": [kit.to_dict() for kit in result.scalars()]}

@router.post("/")
async def create_brand_kit(name: str, config: dict, user=Depends(get_current_user), db=Depends(get_db)):
    kit = BrandKit(user_id=user.id, name=name, config=config)
    db.add(kit)
    await db.commit()
    return {"id": str(kit.id)}

@router.post("/{kit_id}/assets")
async def upload_brand_asset(
    kit_id: str,
    asset_type: str,  # logo_light, logo_dark, font_heading, intro, outro
    file: UploadFile = File(...),
    user=Depends(get_current_user),
):
    # Validate file type, upload to GCS, update brand kit config
    ...

@router.put("/{kit_id}")
async def update_brand_kit(kit_id: str, config: dict, user=Depends(get_current_user)):
    ...

@router.delete("/{kit_id}")
async def delete_brand_kit(kit_id: str, user=Depends(get_current_user)):
    ...
```

### Step 3: Create Brand Application Service
Create `backend/app/services/brand_service.py`:
```python
class BrandApplicationService:
    def apply_logo(self, video_path: str, logo_path: str, position: str, opacity: float) -> str:
        """Overlay logo on video using FFmpeg."""
        pos_map = {
            "top-right": "W-w-20:20",
            "top-left": "20:20",
            "bottom-right": "W-w-20:H-h-20",
            "bottom-left": "20:H-h-20",
        }
        overlay_pos = pos_map.get(position, "W-w-20:20")
        # FFmpeg command: -i video -i logo -filter_complex "[1]format=rgba,colorchannelmixer=aa={opacity}[logo];[0][logo]overlay={pos}"
        ...

    def concat_intro_outro(self, video_path: str, intro_path: str | None, outro_path: str | None) -> str:
        """Prepend intro and append outro using FFmpeg concat demuxer."""
        ...
```

## Best Practices
- **Font validation:** Only accept OTF/TTF. Validate with fontTools before storing.
- **Logo transparency:** Require PNG with alpha channel. Validate before overlay.
- **Intro/outro max 60s:** Enforce on upload. Reject longer videos.
- **Default brand kit:** Each user has at most one default, auto-applied to new clips.

## Testing
- Create brand kit with all fields
- Upload logo, fonts, intro/outro
- Apply brand to a test clip → verify logo overlay
- Verify intro/outro concatenation

## Verification Checklist
- [ ] CRUD operations for brand kits
- [ ] File upload for logos (PNG), fonts (OTF/TTF), intro/outro (MP4)
- [ ] Logo overlay renders correctly at all 4 positions
- [ ] Intro/outro concatenation preserves audio
- [ ] Caption style from brand kit applies to generated clips
- [ ] Default brand kit auto-applies to new clips
- [ ] Multi-brand support (unlimited kits per user)
