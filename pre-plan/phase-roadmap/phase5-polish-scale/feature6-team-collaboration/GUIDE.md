# Team Collaboration — Implementation Guide

## Overview
- **What:** Build a workspace-based team collaboration system with role-based access control (RBAC). Users belong to workspaces with roles (owner, admin, editor, viewer). Workspaces share projects, brand kits, and templates. Includes activity logging and email-based invitation system.
- **Why:** Video production is inherently collaborative. Teams need to share projects, maintain consistent branding, and track who changed what. This feature transforms OpenClip from a single-user tool into a team platform, which is essential for agencies, content teams, and businesses.
- **Dependencies:** Phase 1 Feature 2 (FastAPI Backend), Phase 1 Feature 8 (React Frontend), existing User authentication system

## Architecture

### System Design
```
Workspace Model:
  - A Workspace is the top-level organizational unit
  - Every user has a personal workspace (created on signup)
  - Users can create additional workspaces for teams
  - Resources (projects, brand kits, templates) belong to a workspace

RBAC:
  Owner  -> Full control, billing, delete workspace
  Admin  -> Manage members, manage all resources
  Editor -> Create/edit own resources, view all resources
  Viewer -> Read-only access to all resources

Invitation Flow:
  Owner/Admin invites email
    -> System creates invitation record
    -> Email sent with invite link + token
    -> Invitee clicks link
      -> If existing user: added to workspace
      -> If new user: signup flow, then added to workspace
```

### Data Flow
```
+------------------+
|      Users       |
+--------+---------+
         |
         | many-to-many via workspace_members
         |
+--------+---------+
|    Workspaces    |
+--------+---------+
         |
    +----+----+----+----+
    |         |         |
    v         v         v
Projects  Brand Kits  Templates
    |
    v
  Videos, Clips, etc.
```

### API Endpoints
```
# Workspaces
POST   /api/v1/workspaces                              -> Create workspace
GET    /api/v1/workspaces                              -> List user's workspaces
GET    /api/v1/workspaces/{id}                         -> Get workspace details
PUT    /api/v1/workspaces/{id}                         -> Update workspace settings
DELETE /api/v1/workspaces/{id}                         -> Delete workspace (owner only)

# Members
GET    /api/v1/workspaces/{id}/members                 -> List members
POST   /api/v1/workspaces/{id}/members                 -> Add member directly
PUT    /api/v1/workspaces/{id}/members/{user_id}       -> Update member role
DELETE /api/v1/workspaces/{id}/members/{user_id}       -> Remove member

# Invitations
POST   /api/v1/workspaces/{id}/invitations             -> Send invitation
GET    /api/v1/workspaces/{id}/invitations              -> List pending invitations
DELETE /api/v1/workspaces/{id}/invitations/{invite_id}  -> Revoke invitation
POST   /api/v1/invitations/{token}/accept               -> Accept invitation
POST   /api/v1/invitations/{token}/decline               -> Decline invitation

# Activity Log
GET    /api/v1/workspaces/{id}/activity                 -> Get activity log
```

## GCP Deployment
- **No additional infra required** — all features run on the existing FastAPI backend
- **Email sending:** Use GCP-native approach: Cloud Tasks + SendGrid (free tier: 100 emails/day) or SMTP relay
- **Storage:** Workspace resources stored in existing GCS buckets with workspace-prefixed paths

## Step-by-Step Implementation

### Step 1: Database Migration

Create `backend/alembic/versions/xxxx_add_workspace_tables.py`:
```python
"""Add workspace and collaboration tables

Revision ID: f6g7h8i9j0k1
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "f6g7h8i9j0k1"
down_revision = "<previous_migration>"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Workspaces
    op.create_table(
        "workspaces",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(100), nullable=False, unique=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("avatar_url", sa.String(2048), nullable=True),
        sa.Column("owner_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("is_personal", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("settings", JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_workspaces_owner_id", "workspaces", ["owner_id"])
    op.create_index("ix_workspaces_slug", "workspaces", ["slug"], unique=True)

    # Workspace Members (join table)
    op.create_table(
        "workspace_members",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("workspace_id", UUID(as_uuid=True), sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(20), nullable=False, server_default="viewer"),
        sa.Column("joined_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("workspace_id", "user_id", name="uq_workspace_member"),
    )
    op.create_index("ix_workspace_members_workspace_id", "workspace_members", ["workspace_id"])
    op.create_index("ix_workspace_members_user_id", "workspace_members", ["user_id"])

    # Invitations
    op.create_table(
        "workspace_invitations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("workspace_id", UUID(as_uuid=True), sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("role", sa.String(20), nullable=False, server_default="editor"),
        sa.Column("token", sa.String(255), nullable=False, unique=True),
        sa.Column("invited_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("responded_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_workspace_invitations_token", "workspace_invitations", ["token"], unique=True)
    op.create_index("ix_workspace_invitations_email", "workspace_invitations", ["email"])

    # Activity Log
    op.create_table(
        "workspace_activity",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("workspace_id", UUID(as_uuid=True), sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("resource_type", sa.String(50), nullable=True),
        sa.Column("resource_id", UUID(as_uuid=True), nullable=True),
        sa.Column("details", JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_workspace_activity_workspace_id", "workspace_activity", ["workspace_id"])
    op.create_index("ix_workspace_activity_created_at", "workspace_activity", ["created_at"])

    # Add workspace_id to existing resource tables
    op.add_column("projects", sa.Column("workspace_id", UUID(as_uuid=True), sa.ForeignKey("workspaces.id"), nullable=True))
    op.create_index("ix_projects_workspace_id", "projects", ["workspace_id"])


def downgrade() -> None:
    op.drop_index("ix_projects_workspace_id", "projects")
    op.drop_column("projects", "workspace_id")
    op.drop_table("workspace_activity")
    op.drop_table("workspace_invitations")
    op.drop_table("workspace_members")
    op.drop_table("workspaces")
```

### Step 2: SQLAlchemy Models

Create `backend/app/models/workspace.py`:
```python
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.models.base import Base


class Workspace(Base):
    __tablename__ = "workspaces"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    is_personal: Mapped[bool] = mapped_column(Boolean, default=False)
    settings_json: Mapped[dict | None] = mapped_column("settings", JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    members: Mapped[list["WorkspaceMember"]] = relationship(back_populates="workspace", cascade="all, delete-orphan")
    invitations: Mapped[list["WorkspaceInvitation"]] = relationship(back_populates="workspace", cascade="all, delete-orphan")
    activities: Mapped[list["WorkspaceActivity"]] = relationship(back_populates="workspace", cascade="all, delete-orphan")


class WorkspaceMember(Base):
    __tablename__ = "workspace_members"
    __table_args__ = (UniqueConstraint("workspace_id", "user_id", name="uq_workspace_member"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[str] = mapped_column(String(20), default="viewer")  # owner, admin, editor, viewer
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    workspace: Mapped["Workspace"] = relationship(back_populates="members")


class WorkspaceInvitation(Base):
    __tablename__ = "workspace_invitations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    email: Mapped[str] = mapped_column(String(320), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(20), default="editor")
    token: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    invited_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending, accepted, declined, expired
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    workspace: Mapped["Workspace"] = relationship(back_populates="invitations")


class WorkspaceActivity(Base):
    __tablename__ = "workspace_activity"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    resource_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    resource_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    details: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    workspace: Mapped["Workspace"] = relationship(back_populates="activities")
```

### Step 3: RBAC Permission System

Create `backend/app/core/permissions.py`:
```python
import uuid
from enum import Enum
from functools import wraps

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.workspace import WorkspaceMember


class Role(str, Enum):
    OWNER = "owner"
    ADMIN = "admin"
    EDITOR = "editor"
    VIEWER = "viewer"


# Role hierarchy: higher roles inherit all permissions of lower roles
ROLE_HIERARCHY = {
    Role.OWNER: 4,
    Role.ADMIN: 3,
    Role.EDITOR: 2,
    Role.VIEWER: 1,
}

# Permission definitions
PERMISSIONS = {
    "workspace.update": Role.ADMIN,
    "workspace.delete": Role.OWNER,
    "members.manage": Role.ADMIN,
    "members.view": Role.VIEWER,
    "invitations.send": Role.ADMIN,
    "invitations.view": Role.ADMIN,
    "resources.create": Role.EDITOR,
    "resources.edit": Role.EDITOR,
    "resources.delete": Role.ADMIN,
    "resources.view": Role.VIEWER,
    "activity.view": Role.VIEWER,
}


async def get_member_role(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    user_id: uuid.UUID,
) -> Role | None:
    """Get a user's role in a workspace."""
    result = await db.execute(
        select(WorkspaceMember.role).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id,
        )
    )
    role_str = result.scalar_one_or_none()
    return Role(role_str) if role_str else None


async def check_permission(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    user_id: uuid.UUID,
    permission: str,
) -> bool:
    """Check if a user has a specific permission in a workspace."""
    user_role = await get_member_role(db, workspace_id, user_id)
    if user_role is None:
        return False

    required_role = PERMISSIONS.get(permission)
    if required_role is None:
        return False

    return ROLE_HIERARCHY[user_role] >= ROLE_HIERARCHY[required_role]


async def require_permission(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    user_id: uuid.UUID,
    permission: str,
):
    """Raise 403 if user lacks permission."""
    has_perm = await check_permission(db, workspace_id, user_id, permission)
    if not has_perm:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Insufficient permissions. Required: {permission}",
        )
```

### Step 4: Workspace Service

Create `backend/app/services/workspace_service.py`:
```python
import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone

import structlog
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.permissions import Role, require_permission
from app.models.workspace import (
    Workspace,
    WorkspaceActivity,
    WorkspaceInvitation,
    WorkspaceMember,
)

logger = structlog.get_logger()

INVITE_EXPIRY_DAYS = 7
MAX_MEMBERS_PER_WORKSPACE = 50


class WorkspaceService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_workspace(
        self,
        owner_id: uuid.UUID,
        name: str,
        description: str | None = None,
        is_personal: bool = False,
    ) -> Workspace:
        """Create a new workspace and add owner as first member."""
        slug = self._generate_slug(name)

        workspace = Workspace(
            name=name,
            slug=slug,
            description=description,
            owner_id=owner_id,
            is_personal=is_personal,
        )
        self.db.add(workspace)
        await self.db.flush()

        # Add owner as member
        member = WorkspaceMember(
            workspace_id=workspace.id,
            user_id=owner_id,
            role=Role.OWNER,
        )
        self.db.add(member)

        # Log activity
        await self._log_activity(workspace.id, owner_id, "workspace.created", "workspace", workspace.id)

        await self.db.commit()
        await self.db.refresh(workspace)
        return workspace

    async def list_workspaces(self, user_id: uuid.UUID) -> list[dict]:
        """List all workspaces the user belongs to."""
        result = await self.db.execute(
            select(Workspace, WorkspaceMember.role)
            .join(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
            .where(WorkspaceMember.user_id == user_id)
            .order_by(Workspace.created_at.desc())
        )
        return [
            {"workspace": ws, "role": role}
            for ws, role in result.all()
        ]

    async def get_workspace(self, workspace_id: uuid.UUID) -> Workspace | None:
        result = await self.db.execute(
            select(Workspace)
            .options(joinedload(Workspace.members))
            .where(Workspace.id == workspace_id)
        )
        return result.unique().scalar_one_or_none()

    async def update_workspace(
        self,
        workspace_id: uuid.UUID,
        user_id: uuid.UUID,
        name: str | None = None,
        description: str | None = None,
    ) -> Workspace:
        await require_permission(self.db, workspace_id, user_id, "workspace.update")

        workspace = await self.get_workspace(workspace_id)
        if not workspace:
            raise ValueError("Workspace not found")

        if name is not None:
            workspace.name = name
        if description is not None:
            workspace.description = description

        await self._log_activity(workspace_id, user_id, "workspace.updated", "workspace", workspace_id)
        await self.db.commit()
        return workspace

    async def delete_workspace(self, workspace_id: uuid.UUID, user_id: uuid.UUID):
        await require_permission(self.db, workspace_id, user_id, "workspace.delete")

        workspace = await self.get_workspace(workspace_id)
        if not workspace:
            raise ValueError("Workspace not found")
        if workspace.is_personal:
            raise ValueError("Cannot delete personal workspace")

        await self.db.delete(workspace)
        await self.db.commit()

    # --- Members ---

    async def list_members(self, workspace_id: uuid.UUID, user_id: uuid.UUID) -> list[WorkspaceMember]:
        await require_permission(self.db, workspace_id, user_id, "members.view")

        result = await self.db.execute(
            select(WorkspaceMember).where(WorkspaceMember.workspace_id == workspace_id)
        )
        return list(result.scalars().all())

    async def update_member_role(
        self,
        workspace_id: uuid.UUID,
        target_user_id: uuid.UUID,
        new_role: str,
        actor_id: uuid.UUID,
    ):
        await require_permission(self.db, workspace_id, actor_id, "members.manage")

        result = await self.db.execute(
            select(WorkspaceMember).where(
                WorkspaceMember.workspace_id == workspace_id,
                WorkspaceMember.user_id == target_user_id,
            )
        )
        member = result.scalar_one_or_none()
        if not member:
            raise ValueError("Member not found")

        if member.role == Role.OWNER:
            raise ValueError("Cannot change the owner's role")

        if new_role == Role.OWNER:
            raise ValueError("Cannot promote to owner. Use transfer ownership instead.")

        member.role = new_role
        await self._log_activity(
            workspace_id, actor_id, "member.role_changed",
            "user", target_user_id, {"new_role": new_role},
        )
        await self.db.commit()

    async def remove_member(self, workspace_id: uuid.UUID, target_user_id: uuid.UUID, actor_id: uuid.UUID):
        await require_permission(self.db, workspace_id, actor_id, "members.manage")

        result = await self.db.execute(
            select(WorkspaceMember).where(
                WorkspaceMember.workspace_id == workspace_id,
                WorkspaceMember.user_id == target_user_id,
            )
        )
        member = result.scalar_one_or_none()
        if not member:
            raise ValueError("Member not found")
        if member.role == Role.OWNER:
            raise ValueError("Cannot remove the workspace owner")

        await self.db.delete(member)
        await self._log_activity(workspace_id, actor_id, "member.removed", "user", target_user_id)
        await self.db.commit()

    # --- Invitations ---

    async def send_invitation(
        self,
        workspace_id: uuid.UUID,
        email: str,
        role: str,
        invited_by: uuid.UUID,
    ) -> WorkspaceInvitation:
        await require_permission(self.db, workspace_id, invited_by, "invitations.send")

        # Check if already a member
        existing = await self.db.execute(
            select(WorkspaceMember)
            .join(Workspace)
            .where(
                WorkspaceMember.workspace_id == workspace_id,
            )
        )

        # Check for existing pending invitation
        existing_invite = await self.db.execute(
            select(WorkspaceInvitation).where(
                WorkspaceInvitation.workspace_id == workspace_id,
                WorkspaceInvitation.email == email.lower(),
                WorkspaceInvitation.status == "pending",
            )
        )
        if existing_invite.scalar_one_or_none():
            raise ValueError("Invitation already pending for this email")

        token = secrets.token_urlsafe(32)
        invitation = WorkspaceInvitation(
            workspace_id=workspace_id,
            email=email.lower(),
            role=role,
            token=token,
            invited_by=invited_by,
            expires_at=datetime.now(timezone.utc) + timedelta(days=INVITE_EXPIRY_DAYS),
        )
        self.db.add(invitation)

        await self._log_activity(
            workspace_id, invited_by, "invitation.sent",
            details={"email": email, "role": role},
        )
        await self.db.commit()
        await self.db.refresh(invitation)

        # TODO: Send invitation email via email service
        logger.info("invitation_created", workspace_id=str(workspace_id), email=email, token=token)

        return invitation

    async def accept_invitation(self, token: str, user_id: uuid.UUID) -> WorkspaceMember:
        result = await self.db.execute(
            select(WorkspaceInvitation).where(
                WorkspaceInvitation.token == token,
                WorkspaceInvitation.status == "pending",
            )
        )
        invitation = result.scalar_one_or_none()
        if not invitation:
            raise ValueError("Invalid or expired invitation")

        if invitation.expires_at < datetime.now(timezone.utc):
            invitation.status = "expired"
            await self.db.commit()
            raise ValueError("Invitation has expired")

        # Add as member
        member = WorkspaceMember(
            workspace_id=invitation.workspace_id,
            user_id=user_id,
            role=invitation.role,
        )
        self.db.add(member)

        invitation.status = "accepted"
        invitation.responded_at = datetime.now(timezone.utc)

        await self._log_activity(
            invitation.workspace_id, user_id, "invitation.accepted",
            details={"role": invitation.role},
        )
        await self.db.commit()
        await self.db.refresh(member)
        return member

    async def decline_invitation(self, token: str):
        result = await self.db.execute(
            select(WorkspaceInvitation).where(
                WorkspaceInvitation.token == token,
                WorkspaceInvitation.status == "pending",
            )
        )
        invitation = result.scalar_one_or_none()
        if not invitation:
            raise ValueError("Invalid or expired invitation")

        invitation.status = "declined"
        invitation.responded_at = datetime.now(timezone.utc)
        await self.db.commit()

    # --- Activity Log ---

    async def get_activity(
        self,
        workspace_id: uuid.UUID,
        user_id: uuid.UUID,
        limit: int = 50,
        offset: int = 0,
    ) -> list[WorkspaceActivity]:
        await require_permission(self.db, workspace_id, user_id, "activity.view")

        result = await self.db.execute(
            select(WorkspaceActivity)
            .where(WorkspaceActivity.workspace_id == workspace_id)
            .order_by(WorkspaceActivity.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(result.scalars().all())

    async def _log_activity(
        self,
        workspace_id: uuid.UUID,
        user_id: uuid.UUID,
        action: str,
        resource_type: str | None = None,
        resource_id: uuid.UUID | None = None,
        details: dict | None = None,
    ):
        activity = WorkspaceActivity(
            workspace_id=workspace_id,
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            details=details,
        )
        self.db.add(activity)

    def _generate_slug(self, name: str) -> str:
        slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
        slug = slug[:80]
        # Add random suffix for uniqueness
        suffix = secrets.token_hex(4)
        return f"{slug}-{suffix}"
```

### Step 5: API Routes

Create `backend/app/api/v1/workspaces.py`:
```python
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.core.permissions import Role
from app.models.user import User
from app.services.workspace_service import WorkspaceService

router = APIRouter(prefix="/workspaces", tags=["Workspaces & Collaboration"])


class CreateWorkspaceRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None


class UpdateWorkspaceRequest(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None


class InviteMemberRequest(BaseModel):
    email: EmailStr
    role: str = Field("editor", pattern="^(admin|editor|viewer)$")


class UpdateMemberRoleRequest(BaseModel):
    role: str = Field(..., pattern="^(admin|editor|viewer)$")


class WorkspaceResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    description: str | None
    is_personal: bool
    created_at: str

    model_config = {"from_attributes": True}


# --- Workspace CRUD ---

@router.post("", response_model=WorkspaceResponse, status_code=status.HTTP_201_CREATED)
async def create_workspace(
    req: CreateWorkspaceRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    service = WorkspaceService(db)
    workspace = await service.create_workspace(owner_id=user.id, name=req.name, description=req.description)
    return workspace


@router.get("")
async def list_workspaces(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    service = WorkspaceService(db)
    workspaces = await service.list_workspaces(user.id)
    return {
        "workspaces": [
            {
                "id": str(ws["workspace"].id),
                "name": ws["workspace"].name,
                "slug": ws["workspace"].slug,
                "role": ws["role"],
                "is_personal": ws["workspace"].is_personal,
            }
            for ws in workspaces
        ]
    }


@router.get("/{workspace_id}")
async def get_workspace(
    workspace_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    service = WorkspaceService(db)
    workspace = await service.get_workspace(workspace_id)
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return workspace


@router.put("/{workspace_id}")
async def update_workspace(
    workspace_id: uuid.UUID,
    req: UpdateWorkspaceRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    service = WorkspaceService(db)
    try:
        workspace = await service.update_workspace(workspace_id, user.id, name=req.name, description=req.description)
        return workspace
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{workspace_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workspace(
    workspace_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    service = WorkspaceService(db)
    try:
        await service.delete_workspace(workspace_id, user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# --- Members ---

@router.get("/{workspace_id}/members")
async def list_members(
    workspace_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    service = WorkspaceService(db)
    members = await service.list_members(workspace_id, user.id)
    return {
        "members": [
            {"user_id": str(m.user_id), "role": m.role, "joined_at": str(m.joined_at)}
            for m in members
        ]
    }


@router.put("/{workspace_id}/members/{user_id}")
async def update_member_role(
    workspace_id: uuid.UUID,
    user_id: uuid.UUID,
    req: UpdateMemberRoleRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = WorkspaceService(db)
    try:
        await service.update_member_role(workspace_id, user_id, req.role, current_user.id)
        return {"status": "updated"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{workspace_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    workspace_id: uuid.UUID,
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = WorkspaceService(db)
    try:
        await service.remove_member(workspace_id, user_id, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# --- Invitations ---

@router.post("/{workspace_id}/invitations")
async def send_invitation(
    workspace_id: uuid.UUID,
    req: InviteMemberRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    service = WorkspaceService(db)
    try:
        invitation = await service.send_invitation(workspace_id, req.email, req.role, user.id)
        return {
            "id": str(invitation.id),
            "email": invitation.email,
            "role": invitation.role,
            "status": invitation.status,
            "expires_at": str(invitation.expires_at),
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{workspace_id}/invitations")
async def list_invitations(
    workspace_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.core.permissions import require_permission
    from sqlalchemy import select
    from app.models.workspace import WorkspaceInvitation

    await require_permission(db, workspace_id, user.id, "invitations.view")
    result = await db.execute(
        select(WorkspaceInvitation).where(
            WorkspaceInvitation.workspace_id == workspace_id,
            WorkspaceInvitation.status == "pending",
        )
    )
    invitations = result.scalars().all()
    return {
        "invitations": [
            {"id": str(i.id), "email": i.email, "role": i.role, "expires_at": str(i.expires_at)}
            for i in invitations
        ]
    }


# --- Accept/Decline (no workspace prefix, uses token) ---

invitation_router = APIRouter(prefix="/invitations", tags=["Invitations"])


@invitation_router.post("/{token}/accept")
async def accept_invitation(
    token: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    service = WorkspaceService(db)
    try:
        member = await service.accept_invitation(token, user.id)
        return {"status": "accepted", "workspace_id": str(member.workspace_id), "role": member.role}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@invitation_router.post("/{token}/decline")
async def decline_invitation(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    service = WorkspaceService(db)
    try:
        await service.decline_invitation(token)
        return {"status": "declined"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# --- Activity Log ---

@router.get("/{workspace_id}/activity")
async def get_activity(
    workspace_id: uuid.UUID,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    service = WorkspaceService(db)
    activities = await service.get_activity(workspace_id, user.id, limit, offset)
    return {
        "activities": [
            {
                "id": str(a.id),
                "action": a.action,
                "user_id": str(a.user_id) if a.user_id else None,
                "resource_type": a.resource_type,
                "details": a.details,
                "created_at": str(a.created_at),
            }
            for a in activities
        ]
    }
```

Register in `backend/app/api/v1/router.py`:
```python
from app.api.v1.workspaces import router as workspaces_router, invitation_router

api_v1_router.include_router(workspaces_router)
api_v1_router.include_router(invitation_router)
```

### Step 6: Workspace Middleware (Auto-scope Resources)

Create `backend/app/core/workspace_context.py`:
```python
import uuid
from contextvars import ContextVar

from fastapi import Header, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import check_permission
from app.models.workspace import WorkspaceMember

# Context var to hold current workspace
current_workspace_id: ContextVar[uuid.UUID | None] = ContextVar("current_workspace_id", default=None)


async def get_workspace_from_header(
    x_workspace_id: str | None = Header(None),
) -> uuid.UUID | None:
    """Extract workspace ID from request header."""
    if x_workspace_id:
        try:
            ws_id = uuid.UUID(x_workspace_id)
            current_workspace_id.set(ws_id)
            return ws_id
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid workspace ID in X-Workspace-Id header")
    return None


async def require_workspace_access(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    user_id: uuid.UUID,
    permission: str = "resources.view",
):
    """Verify user has access to workspace resources."""
    has_access = await check_permission(db, workspace_id, user_id, permission)
    if not has_access:
        raise HTTPException(status_code=403, detail="No access to this workspace")
```

### Step 7: Frontend — Workspace Switcher

Create `frontend/src/components/workspace/WorkspaceSwitcher.tsx`:
```tsx
"use client";

import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api";
import { useWorkspace } from "@/hooks/useWorkspace";

interface WorkspaceItem {
  id: string;
  name: string;
  slug: string;
  role: string;
  is_personal: boolean;
}

export function WorkspaceSwitcher() {
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const { currentWorkspace, setCurrentWorkspace } = useWorkspace();

  useEffect(() => {
    async function loadWorkspaces() {
      const data = await apiClient.get<{ workspaces: WorkspaceItem[] }>("/api/v1/workspaces");
      setWorkspaces(data.workspaces);

      // Set default workspace if none selected
      if (!currentWorkspace && data.workspaces.length > 0) {
        const personal = data.workspaces.find((w) => w.is_personal);
        setCurrentWorkspace(personal || data.workspaces[0]);
      }
    }
    loadWorkspaces();
  }, []);

  return (
    <div className="flex items-center gap-2">
      <Select
        value={currentWorkspace?.id}
        onValueChange={(id) => {
          const ws = workspaces.find((w) => w.id === id);
          if (ws) setCurrentWorkspace(ws);
        }}
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Select workspace" />
        </SelectTrigger>
        <SelectContent>
          {workspaces.map((ws) => (
            <SelectItem key={ws.id} value={ws.id}>
              {ws.name}
              {ws.is_personal && " (Personal)"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
```

Create `frontend/src/hooks/useWorkspace.ts`:
```tsx
"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface WorkspaceItem {
  id: string;
  name: string;
  slug: string;
  role: string;
  is_personal: boolean;
}

interface WorkspaceStore {
  currentWorkspace: WorkspaceItem | null;
  setCurrentWorkspace: (ws: WorkspaceItem) => void;
}

export const useWorkspace = create<WorkspaceStore>()(
  persist(
    (set) => ({
      currentWorkspace: null,
      setCurrentWorkspace: (ws) => set({ currentWorkspace: ws }),
    }),
    { name: "openclip-workspace" }
  )
);
```

## Best Practices
- **Personal workspace on signup:** Automatically create a personal workspace for every new user. This ensures all existing resources have a workspace context.
- **Workspace-scoped queries:** All resource queries (projects, videos, templates) should filter by `workspace_id`. Use the `X-Workspace-Id` header pattern for API requests.
- **Slug uniqueness:** Generate slugs with random suffixes to avoid collisions without requiring retries.
- **Activity log retention:** Archive activity logs older than 90 days to a separate table or GCS to keep the main table performant.
- **Invitation security:** Use `secrets.token_urlsafe(32)` for invitation tokens. Tokens expire after 7 days. Rate-limit invitation sending to prevent spam.
- **Cannot remove owner:** The workspace owner cannot be removed or demoted. Implement a separate "transfer ownership" action if needed.
- **Cascade deletes:** When a workspace is deleted, cascade to members, invitations, and activity. Resource deletion should be confirmed separately.

## Testing
- Create a workspace and verify owner is automatically added as a member
- Invite a user by email and verify invitation record is created
- Accept invitation and verify member is added with correct role
- Test role hierarchy: viewer cannot create resources, editor can
- Test that owner cannot be removed or demoted
- Test invitation expiry (7 days)
- Verify activity log records all actions
- Test workspace deletion cascades correctly
- Test slug generation produces unique values
- Verify personal workspace is created on user signup

## Verification Checklist
- [ ] Workspace CRUD operations work correctly
- [ ] Personal workspace created automatically on signup
- [ ] Owner, admin, editor, viewer roles enforced correctly
- [ ] Role hierarchy: higher roles inherit lower role permissions
- [ ] Invitation flow: send, accept, decline, expire
- [ ] Invitation token is cryptographically random and unique
- [ ] Activity log records all workspace actions
- [ ] Workspace-scoped queries filter resources correctly
- [ ] X-Workspace-Id header pattern works for API requests
- [ ] Cannot remove or demote workspace owner
- [ ] Cannot invite already-existing member
- [ ] Workspace deletion cascades to all related records
- [ ] Frontend workspace switcher updates API context
- [ ] Members list shows all workspace members with roles
- [ ] Rate limiting on invitation sending
