# Template Marketplace — Implementation Guide

## Overview
- **What:** Build a community-driven marketplace where users can browse, share, rate, and install video templates (Remotion compositions), caption styles, and brand kit presets. Includes template submission, review process, and discovery features.
- **Why:** A marketplace creates a flywheel: more templates attract more users, who create more templates. It reduces the burden on core developers to build every template while empowering the community.
- **Dependencies:** Phase 5 Feature 8 (Plugin System), Phase 3 Feature 7 (Faceless Templates), Phase 2 Feature 5 (Caption Styles)

## Architecture

### Marketplace Flow
```
Creator → Submit template (ZIP) → Automated validation → Admin review
  → Publish to marketplace → Users browse/search/filter
  → Install template → Available in video creation workflow

Discovery:
  Browse → Featured / Popular / New / Category filters
  Search → Full-text search on name, description, tags
  Preview → Video preview + screenshots + live demo
```

### Data Model
```sql
MarketplaceTemplate
  - id: UUID (PK)
  - author_id: FK(User)
  - name: string (unique)
  - display_name: string
  - description: text
  - category: enum(faceless, caption, brand, transition, overlay)
  - tags: string[]
  - version: string
  - preview_video_url: string
  - preview_images: string[] (up to 5 screenshots)
  - download_url: string (GCS path to ZIP)
  - file_size_bytes: int
  - install_count: int
  - rating_avg: float
  - rating_count: int
  - status: enum(draft, pending_review, published, rejected, deprecated)
  - rejection_reason: text?
  - created_at: timestamp
  - updated_at: timestamp

TemplateRating
  - id: UUID (PK)
  - template_id: FK(MarketplaceTemplate)
  - user_id: FK(User)
  - rating: int (1-5)
  - review: text?
  - created_at: timestamp
  - UNIQUE(template_id, user_id)

TemplateInstall
  - id: UUID (PK)
  - template_id: FK(MarketplaceTemplate)
  - user_id: FK(User)
  - version: string
  - installed_at: timestamp
```

### Template Package Format
```
my-template.zip
├── manifest.json              # Template metadata + config
├── preview.mp4                # 15-30s preview video
├── screenshots/
│   ├── 1.png                  # Template screenshots
│   └── 2.png
├── src/
│   ├── Template.tsx           # Remotion composition
│   ├── styles.module.css      # Styles
│   └── assets/                # Fonts, images bundled with template
└── README.md                  # Usage instructions
```

## Step-by-Step Implementation

### Step 1: Create Database Models

```python
# backend/app/models/marketplace.py
import enum
from sqlalchemy import String, Integer, Float, Text, JSON, Enum, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import BaseModel

class TemplateCategory(str, enum.Enum):
    FACELESS = "faceless"
    CAPTION = "caption"
    BRAND = "brand"
    TRANSITION = "transition"
    OVERLAY = "overlay"

class TemplateStatus(str, enum.Enum):
    DRAFT = "draft"
    PENDING_REVIEW = "pending_review"
    PUBLISHED = "published"
    REJECTED = "rejected"
    DEPRECATED = "deprecated"

class MarketplaceTemplate(BaseModel):
    __tablename__ = "marketplace_templates"
    author_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    name: Mapped[str] = mapped_column(String(100), unique=True)
    display_name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text)
    category: Mapped[TemplateCategory] = mapped_column(Enum(TemplateCategory))
    tags: Mapped[list] = mapped_column(ARRAY(String), default=list)
    version: Mapped[str] = mapped_column(String(20))
    preview_video_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    preview_images: Mapped[list] = mapped_column(JSON, default=list)
    download_url: Mapped[str] = mapped_column(String(2048))
    file_size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    install_count: Mapped[int] = mapped_column(Integer, default=0)
    rating_avg: Mapped[float] = mapped_column(Float, default=0.0)
    rating_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[TemplateStatus] = mapped_column(Enum(TemplateStatus), default=TemplateStatus.DRAFT)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    ratings = relationship("TemplateRating", back_populates="template")

class TemplateRating(BaseModel):
    __tablename__ = "template_ratings"
    __table_args__ = (UniqueConstraint("template_id", "user_id"),)
    template_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("marketplace_templates.id"))
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    rating: Mapped[int] = mapped_column(Integer)  # 1-5
    review: Mapped[str | None] = mapped_column(Text, nullable=True)
    template = relationship("MarketplaceTemplate", back_populates="ratings")

class TemplateInstall(BaseModel):
    __tablename__ = "template_installs"
    template_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("marketplace_templates.id"))
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    version: Mapped[str] = mapped_column(String(20))
```

### Step 2: Create Marketplace Service

```python
# backend/app/services/marketplace_service.py
import io
import json
import zipfile
from uuid import UUID

import structlog
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.marketplace import (
    MarketplaceTemplate, TemplateRating, TemplateInstall,
    TemplateStatus, TemplateCategory,
)
from app.services.storage_service import StorageService

logger = structlog.get_logger()

MAX_UPLOAD_SIZE = 50 * 1024 * 1024  # 50 MB
REQUIRED_FILES = {"manifest.json"}

class MarketplaceService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.storage = StorageService()

    async def submit_template(self, author_id: UUID, file_bytes: bytes, name: str) -> MarketplaceTemplate:
        """Validate and submit a template ZIP for review."""
        if len(file_bytes) > MAX_UPLOAD_SIZE:
            raise ValueError(f"Template ZIP must be under {MAX_UPLOAD_SIZE // (1024*1024)} MB")

        # Validate ZIP structure
        zip_buf = io.BytesIO(file_bytes)
        if not zipfile.is_zipfile(zip_buf):
            raise ValueError("Upload must be a valid ZIP file")

        with zipfile.ZipFile(zip_buf) as zf:
            filenames = set(zf.namelist())
            missing = REQUIRED_FILES - filenames
            if missing:
                raise ValueError(f"ZIP missing required files: {missing}")

            # Parse manifest
            manifest = json.loads(zf.read("manifest.json"))
            if "name" not in manifest or "version" not in manifest:
                raise ValueError("manifest.json must include 'name' and 'version'")

            # Security: check for path traversal
            for name_in_zip in zf.namelist():
                if name_in_zip.startswith("/") or ".." in name_in_zip:
                    raise ValueError(f"Invalid path in ZIP: {name_in_zip}")

        # Upload ZIP to storage
        storage_path = f"marketplace/{name}/{manifest['version']}/template.zip"
        download_url = await self.storage.upload_bytes(file_bytes, storage_path, "application/zip")

        # Upload preview assets if present
        preview_images = []
        with zipfile.ZipFile(zip_buf) as zf:
            for fname in zf.namelist():
                if fname.startswith("screenshots/") and fname.endswith((".png", ".jpg", ".webp")):
                    img_bytes = zf.read(fname)
                    img_path = f"marketplace/{name}/{manifest['version']}/{fname}"
                    img_url = await self.storage.upload_bytes(img_bytes, img_path, "image/png")
                    preview_images.append(img_url)

            if "preview.mp4" in filenames:
                video_bytes = zf.read("preview.mp4")
                video_path = f"marketplace/{name}/{manifest['version']}/preview.mp4"
                preview_video_url = await self.storage.upload_bytes(video_bytes, video_path, "video/mp4")
            else:
                preview_video_url = None

        template = MarketplaceTemplate(
            author_id=author_id,
            name=name,
            display_name=manifest.get("displayName", name),
            description=manifest.get("description", ""),
            category=manifest.get("category", "faceless"),
            tags=manifest.get("tags", []),
            version=manifest["version"],
            preview_video_url=preview_video_url,
            preview_images=preview_images,
            download_url=download_url,
            file_size_bytes=len(file_bytes),
            status=TemplateStatus.PENDING_REVIEW,
        )
        self.db.add(template)
        await self.db.commit()
        await self.db.refresh(template)
        return template

    async def browse(
        self,
        category: TemplateCategory | None = None,
        search: str | None = None,
        sort: str = "popular",
        page: int = 1,
        per_page: int = 20,
    ) -> tuple[list[MarketplaceTemplate], int]:
        """Browse published templates with filters."""
        query = select(MarketplaceTemplate).where(
            MarketplaceTemplate.status == TemplateStatus.PUBLISHED
        )

        if category:
            query = query.where(MarketplaceTemplate.category == category)

        if search:
            search_filter = MarketplaceTemplate.display_name.ilike(f"%{search}%")
            query = query.where(search_filter)

        # Sorting
        if sort == "popular":
            query = query.order_by(desc(MarketplaceTemplate.install_count))
        elif sort == "rating":
            query = query.order_by(desc(MarketplaceTemplate.rating_avg))
        elif sort == "newest":
            query = query.order_by(desc(MarketplaceTemplate.created_at))

        # Count total
        count_query = select(func.count()).select_from(query.subquery())
        total = (await self.db.execute(count_query)).scalar() or 0

        # Paginate
        query = query.offset((page - 1) * per_page).limit(per_page)
        results = (await self.db.execute(query)).scalars().all()

        return list(results), total

    async def install_template(self, template_id: UUID, user_id: UUID) -> str:
        """Install a template for a user. Returns download URL."""
        template = (await self.db.execute(
            select(MarketplaceTemplate).where(MarketplaceTemplate.id == template_id)
        )).scalar_one_or_none()

        if not template or template.status != TemplateStatus.PUBLISHED:
            raise ValueError("Template not found or not published")

        # Record install
        install = TemplateInstall(
            template_id=template_id,
            user_id=user_id,
            version=template.version,
        )
        self.db.add(install)
        template.install_count += 1
        await self.db.commit()

        return template.download_url

    async def rate_template(self, template_id: UUID, user_id: UUID, rating: int, review: str | None = None) -> None:
        """Rate a template (1-5). Upserts existing rating."""
        if not 1 <= rating <= 5:
            raise ValueError("Rating must be between 1 and 5")

        existing = (await self.db.execute(
            select(TemplateRating).where(
                TemplateRating.template_id == template_id,
                TemplateRating.user_id == user_id,
            )
        )).scalar_one_or_none()

        if existing:
            existing.rating = rating
            existing.review = review
        else:
            self.db.add(TemplateRating(
                template_id=template_id,
                user_id=user_id,
                rating=rating,
                review=review,
            ))

        await self.db.commit()

        # Recalculate average
        template = (await self.db.execute(
            select(MarketplaceTemplate).where(MarketplaceTemplate.id == template_id)
        )).scalar_one()

        avg_result = await self.db.execute(
            select(func.avg(TemplateRating.rating), func.count(TemplateRating.id))
            .where(TemplateRating.template_id == template_id)
        )
        avg, count = avg_result.one()
        template.rating_avg = float(avg or 0)
        template.rating_count = count or 0
        await self.db.commit()
```

### Step 3: Create Marketplace API

```python
# backend/app/api/v1/marketplace.py
from fastapi import APIRouter, Depends, File, UploadFile, Query, HTTPException
from app.core.deps import get_current_user, require_admin, get_db
from app.services.marketplace_service import MarketplaceService

router = APIRouter()

@router.get("/")
async def browse_templates(
    category: str | None = None,
    search: str | None = None,
    sort: str = Query("popular", enum=["popular", "rating", "newest"]),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db=Depends(get_db),
):
    """Browse published marketplace templates."""
    service = MarketplaceService(db)
    templates, total = await service.browse(category=category, search=search, sort=sort, page=page, per_page=per_page)
    return {
        "templates": [
            {
                "id": str(t.id),
                "name": t.name,
                "displayName": t.display_name,
                "description": t.description,
                "category": t.category,
                "tags": t.tags,
                "version": t.version,
                "previewVideo": t.preview_video_url,
                "previewImages": t.preview_images,
                "installs": t.install_count,
                "rating": t.rating_avg,
                "ratingCount": t.rating_count,
            }
            for t in templates
        ],
        "total": total,
        "page": page,
        "perPage": per_page,
    }

@router.post("/submit")
async def submit_template(
    file: UploadFile = File(...),
    name: str = Query(..., pattern=r"^[a-z0-9\-]+$"),
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    """Submit a template ZIP for review."""
    file_bytes = await file.read()
    service = MarketplaceService(db)
    template = await service.submit_template(user.id, file_bytes, name)
    return {"id": str(template.id), "status": template.status, "message": "Template submitted for review"}

@router.post("/{template_id}/install")
async def install_template(template_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    """Install a template."""
    service = MarketplaceService(db)
    download_url = await service.install_template(template_id, user.id)
    return {"downloadUrl": download_url}

@router.post("/{template_id}/rate")
async def rate_template(
    template_id: str,
    rating: int = Query(..., ge=1, le=5),
    review: str | None = None,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    """Rate a template (1-5 stars)."""
    service = MarketplaceService(db)
    await service.rate_template(template_id, user.id, rating, review)
    return {"status": "rated"}

@router.get("/{template_id}")
async def get_template(template_id: str, db=Depends(get_db)):
    """Get full template details."""
    from sqlalchemy import select
    from app.models.marketplace import MarketplaceTemplate, TemplateStatus
    template = (await db.execute(
        select(MarketplaceTemplate).where(
            MarketplaceTemplate.id == template_id,
            MarketplaceTemplate.status == TemplateStatus.PUBLISHED,
        )
    )).scalar_one_or_none()
    if not template:
        raise HTTPException(404, "Template not found")
    return {
        "id": str(template.id),
        "name": template.name,
        "displayName": template.display_name,
        "description": template.description,
        "category": template.category,
        "tags": template.tags,
        "version": template.version,
        "previewVideo": template.preview_video_url,
        "previewImages": template.preview_images,
        "installs": template.install_count,
        "rating": template.rating_avg,
        "ratingCount": template.rating_count,
        "fileSize": template.file_size_bytes,
    }

# Admin endpoints
@router.get("/admin/pending", dependencies=[Depends(require_admin)])
async def list_pending_templates(db=Depends(get_db)):
    """List templates pending review (admin only)."""
    from sqlalchemy import select
    from app.models.marketplace import MarketplaceTemplate, TemplateStatus
    templates = (await db.execute(
        select(MarketplaceTemplate).where(MarketplaceTemplate.status == TemplateStatus.PENDING_REVIEW)
    )).scalars().all()
    return [{"id": str(t.id), "name": t.name, "author_id": str(t.author_id)} for t in templates]

@router.post("/admin/{template_id}/approve", dependencies=[Depends(require_admin)])
async def approve_template(template_id: str, db=Depends(get_db)):
    """Approve a pending template (admin only)."""
    from sqlalchemy import select
    from app.models.marketplace import MarketplaceTemplate, TemplateStatus
    template = (await db.execute(
        select(MarketplaceTemplate).where(MarketplaceTemplate.id == template_id)
    )).scalar_one_or_none()
    if not template:
        raise HTTPException(404)
    template.status = TemplateStatus.PUBLISHED
    await db.commit()
    return {"status": "published"}

@router.post("/admin/{template_id}/reject", dependencies=[Depends(require_admin)])
async def reject_template(template_id: str, reason: str, db=Depends(get_db)):
    """Reject a pending template with reason (admin only)."""
    from sqlalchemy import select
    from app.models.marketplace import MarketplaceTemplate, TemplateStatus
    template = (await db.execute(
        select(MarketplaceTemplate).where(MarketplaceTemplate.id == template_id)
    )).scalar_one_or_none()
    if not template:
        raise HTTPException(404)
    template.status = TemplateStatus.REJECTED
    template.rejection_reason = reason
    await db.commit()
    return {"status": "rejected"}
```

### Step 4: Create Frontend Marketplace UI

```typescript
// frontend/src/app/marketplace/page.tsx
"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Star, Download, Search } from "lucide-react";
import { apiClient } from "@/lib/api";

interface Template {
  id: string;
  displayName: string;
  description: string;
  category: string;
  tags: string[];
  previewImages: string[];
  installs: number;
  rating: number;
  ratingCount: number;
}

export default function MarketplacePage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [sort, setSort] = useState("popular");

  const { data } = useQuery({
    queryKey: ["marketplace", search, category, sort],
    queryFn: () =>
      apiClient.get("/marketplace", {
        params: { search: search || undefined, category: category === "all" ? undefined : category, sort },
      }).then((r) => r.data),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Template Marketplace</h1>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search templates..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="faceless">Faceless</SelectItem>
            <SelectItem value="caption">Captions</SelectItem>
            <SelectItem value="brand">Brand Kits</SelectItem>
            <SelectItem value="transition">Transitions</SelectItem>
            <SelectItem value="overlay">Overlays</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="popular">Popular</SelectItem>
            <SelectItem value="rating">Top Rated</SelectItem>
            <SelectItem value="newest">Newest</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {data?.templates?.map((template: Template) => (
          <TemplateCard key={template.id} template={template} />
        ))}
      </div>
    </div>
  );
}

function TemplateCard({ template }: { template: Template }) {
  return (
    <a href={`/marketplace/${template.id}`} className="group rounded-lg border bg-card p-4 transition-shadow hover:shadow-md">
      {template.previewImages[0] && (
        <img src={template.previewImages[0]} alt={template.displayName} className="mb-3 aspect-video w-full rounded-md object-cover" />
      )}
      <h3 className="font-semibold group-hover:text-primary">{template.displayName}</h3>
      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{template.description}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {template.tags.slice(0, 3).map((tag) => (
          <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
        <span className="flex items-center gap-1">
          <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
          {template.rating.toFixed(1)} ({template.ratingCount})
        </span>
        <span className="flex items-center gap-1">
          <Download className="h-3.5 w-3.5" />
          {template.installs.toLocaleString()}
        </span>
      </div>
    </a>
  );
}
```

## Best Practices
- **ZIP validation is security-critical:** Always check for path traversal (`../`), absolute paths, and file size limits before extracting.
- **Admin review before publishing:** Never auto-publish templates. They could contain malicious code that runs in Remotion.
- **Immutable versions:** Once a version is published, it cannot be changed. Authors must submit a new version.
- **Preview video required for quality:** Templates without preview videos get lower marketplace visibility.
- **Rate limiting on installs:** Prevent install count inflation by limiting to 1 install per user per template.
- **Full-text search:** Use PostgreSQL `tsvector` for efficient search across name, description, and tags.

## Testing
- Submit a valid template ZIP → verify pending_review status
- Submit an invalid ZIP (missing manifest) → verify rejection
- Submit a ZIP with path traversal → verify security rejection
- Approve template → verify it appears in browse results
- Install template → verify install count increments
- Rate template → verify average recalculates correctly
- Search templates → verify results match query
- Browse with category filter → verify correct filtering

## Verification Checklist
- [ ] Template ZIP upload and validation works
- [ ] Manifest schema validated correctly
- [ ] Path traversal attacks blocked
- [ ] Admin review workflow (pending → approve/reject)
- [ ] Browse with search, category, sort, pagination
- [ ] Template detail page with previews
- [ ] Install flow downloads template ZIP
- [ ] Rating system (1-5 stars, one per user)
- [ ] Install count tracking (no duplicates)
- [ ] Frontend marketplace page renders correctly
- [ ] Admin panel shows pending templates
