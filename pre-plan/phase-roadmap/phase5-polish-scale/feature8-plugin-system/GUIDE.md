# Plugin System — Implementation Guide

## Overview
- **What:** Build an extension architecture that allows third-party developers to add custom templates, AI models, export formats, and integrations via a standardized plugin API with sandboxed execution.
- **Why:** A plugin ecosystem turns OpenClip from a tool into a platform. Community contributors can extend functionality without modifying core code, accelerating feature development.
- **Dependencies:** Phase 2 Feature 8 (REST API), Phase 1 Feature 2 (FastAPI Backend)

## Architecture

### Plugin Types
```
1. Template Plugins     — Custom Remotion video templates
2. Model Plugins        — Additional AI models (TTS voices, LLMs, image generators)
3. Export Plugins       — Custom export formats or post-processing
4. Integration Plugins  — Third-party service connectors (storage, CDN, platforms)
5. Hook Plugins         — Event listeners that run on lifecycle events
```

### Plugin Lifecycle
```
Install → Validate Manifest → Register Hooks → Activate
  → On Event: Load → Execute in Sandbox → Return Result
  → Deactivate → Uninstall → Cleanup
```

### Directory Structure
```
backend/
├── app/
│   ├── plugins/
│   │   ├── __init__.py
│   │   ├── manager.py          # PluginManager: load, register, execute
│   │   ├── registry.py         # Plugin registry (in-memory + DB)
│   │   ├── sandbox.py          # Sandboxed execution environment
│   │   ├── hooks.py            # Hook system (event → plugin mapping)
│   │   ├── manifest.py         # Manifest schema validation
│   │   └── base.py             # Base plugin class
│   ├── api/v1/
│   │   └── plugins.py          # Plugin management API
│   └── models/
│       └── plugin.py           # Plugin DB model

plugins/                         # Installed plugins directory
├── openclip-reddit-template/
│   ├── manifest.json
│   ├── main.py
│   └── templates/
│       └── RedditStory.tsx
└── openclip-elevenlabs-tts/
    ├── manifest.json
    └── main.py
```

### Plugin Manifest
```json
{
  "name": "openclip-reddit-template",
  "version": "1.0.0",
  "displayName": "Reddit Story Template",
  "description": "Custom Reddit story template with dark mode and upvote animations",
  "author": "community-dev",
  "license": "MIT",
  "type": "template",
  "engine": "openclip >= 1.0.0",
  "entrypoint": "main.py",
  "hooks": ["template.register", "video.pre_render"],
  "permissions": ["storage:read", "storage:write", "network:pexels.com"],
  "config": {
    "darkMode": { "type": "boolean", "default": true },
    "accentColor": { "type": "string", "default": "#ff4500" }
  }
}
```

## Step-by-Step Implementation

### Step 1: Create Plugin Base Class and Manifest Schema

```python
# backend/app/plugins/manifest.py
from pydantic import BaseModel, Field

class PluginConfig(BaseModel):
    type: str  # "boolean", "string", "number", "select"
    default: str | int | float | bool | None = None
    options: list[str] | None = None  # for "select" type
    description: str | None = None

class PluginManifest(BaseModel):
    name: str = Field(pattern=r"^[a-z0-9\-]+$")
    version: str = Field(pattern=r"^\d+\.\d+\.\d+$")
    display_name: str = Field(alias="displayName")
    description: str
    author: str
    license: str = "MIT"
    type: str  # "template", "model", "export", "integration", "hook"
    engine: str = "openclip >= 1.0.0"
    entrypoint: str = "main.py"
    hooks: list[str] = []
    permissions: list[str] = []
    config: dict[str, PluginConfig] = {}
```

```python
# backend/app/plugins/base.py
from abc import ABC, abstractmethod
from typing import Any

class BasePlugin(ABC):
    def __init__(self, manifest: dict, config: dict):
        self.manifest = manifest
        self.config = config

    @abstractmethod
    async def activate(self) -> None:
        """Called when plugin is activated."""
        ...

    @abstractmethod
    async def deactivate(self) -> None:
        """Called when plugin is deactivated."""
        ...

    async def on_hook(self, hook_name: str, data: dict) -> Any:
        """Called when a registered hook fires."""
        handler = getattr(self, f"handle_{hook_name.replace('.', '_')}", None)
        if handler:
            return await handler(data)
        return None


class TemplatePlugin(BasePlugin):
    """Base class for template plugins."""

    @abstractmethod
    def get_templates(self) -> list[dict]:
        """Return list of template definitions."""
        ...


class ModelPlugin(BasePlugin):
    """Base class for model plugins."""

    @abstractmethod
    async def predict(self, input_data: dict) -> dict:
        """Run inference with the model."""
        ...
```

### Step 2: Create Plugin Manager

```python
# backend/app/plugins/manager.py
import importlib.util
import json
from pathlib import Path

import structlog

from app.plugins.base import BasePlugin
from app.plugins.manifest import PluginManifest
from app.plugins.sandbox import SandboxedExecutor

logger = structlog.get_logger()

PLUGINS_DIR = Path("plugins")
ALLOWED_PERMISSIONS = {
    "storage:read", "storage:write",
    "network:*",  # wildcards resolved at validation
    "jobs:create", "jobs:read",
}

class PluginManager:
    def __init__(self):
        self.plugins: dict[str, BasePlugin] = {}
        self.hooks: dict[str, list[str]] = {}  # hook_name → [plugin_name]

    async def discover(self) -> list[PluginManifest]:
        """Scan plugins directory for valid plugins."""
        manifests = []
        if not PLUGINS_DIR.exists():
            return manifests
        for plugin_dir in PLUGINS_DIR.iterdir():
            if not plugin_dir.is_dir():
                continue
            manifest_path = plugin_dir / "manifest.json"
            if manifest_path.exists():
                raw = json.loads(manifest_path.read_text())
                manifest = PluginManifest(**raw)
                manifests.append(manifest)
        return manifests

    async def load(self, plugin_name: str, user_config: dict | None = None) -> BasePlugin:
        """Load and activate a plugin."""
        plugin_dir = PLUGINS_DIR / plugin_name
        manifest_path = plugin_dir / "manifest.json"
        raw = json.loads(manifest_path.read_text())
        manifest = PluginManifest(**raw)

        # Validate permissions
        self._validate_permissions(manifest.permissions)

        # Load the entrypoint module
        entry = plugin_dir / manifest.entrypoint
        spec = importlib.util.spec_from_file_location(plugin_name, entry)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)

        # Instantiate plugin class (expects a `Plugin` class in entrypoint)
        config = {**{k: v.default for k, v in manifest.config.items()}, **(user_config or {})}
        plugin: BasePlugin = module.Plugin(manifest=raw, config=config)
        await plugin.activate()

        self.plugins[plugin_name] = plugin
        for hook in manifest.hooks:
            self.hooks.setdefault(hook, []).append(plugin_name)

        logger.info("plugin.loaded", name=plugin_name, hooks=manifest.hooks)
        return plugin

    async def unload(self, plugin_name: str) -> None:
        """Deactivate and unload a plugin."""
        plugin = self.plugins.pop(plugin_name, None)
        if plugin:
            await plugin.deactivate()
            for hook_plugins in self.hooks.values():
                if plugin_name in hook_plugins:
                    hook_plugins.remove(plugin_name)

    async def emit(self, hook_name: str, data: dict) -> list[dict]:
        """Fire a hook and collect results from all listening plugins."""
        results = []
        for plugin_name in self.hooks.get(hook_name, []):
            plugin = self.plugins.get(plugin_name)
            if plugin:
                result = await plugin.on_hook(hook_name, data)
                if result is not None:
                    results.append({"plugin": plugin_name, "result": result})
        return results

    def _validate_permissions(self, permissions: list[str]) -> None:
        for perm in permissions:
            base = perm.split(":")[0] + ":*"
            if perm not in ALLOWED_PERMISSIONS and base not in ALLOWED_PERMISSIONS:
                raise PermissionError(f"Plugin requests disallowed permission: {perm}")
```

### Step 3: Create Plugin Database Model

```python
# backend/app/models/plugin.py
from sqlalchemy import String, Boolean, JSON, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import BaseModel

class InstalledPlugin(BaseModel):
    __tablename__ = "installed_plugins"
    name: Mapped[str] = mapped_column(String(255), unique=True)
    version: Mapped[str] = mapped_column(String(50))
    display_name: Mapped[str] = mapped_column(String(255))
    plugin_type: Mapped[str] = mapped_column(String(50))
    description: Mapped[str] = mapped_column(Text)
    author: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    user_config: Mapped[dict] = mapped_column(JSON, default=dict)
    permissions: Mapped[list] = mapped_column(JSON, default=list)
```

### Step 4: Create Plugin API Endpoints

```python
# backend/app/api/v1/plugins.py
from fastapi import APIRouter, Depends, HTTPException
from app.core.deps import get_current_user, require_admin
from app.plugins.manager import PluginManager

router = APIRouter()
plugin_manager = PluginManager()

@router.get("/")
async def list_plugins(user=Depends(get_current_user)):
    """List all discovered plugins with their status."""
    manifests = await plugin_manager.discover()
    loaded = set(plugin_manager.plugins.keys())
    return [
        {
            "name": m.name,
            "displayName": m.display_name,
            "version": m.version,
            "type": m.type,
            "active": m.name in loaded,
            "permissions": m.permissions,
        }
        for m in manifests
    ]

@router.post("/{plugin_name}/activate")
async def activate_plugin(plugin_name: str, config: dict | None = None, user=Depends(require_admin)):
    """Activate a plugin (admin only)."""
    try:
        await plugin_manager.load(plugin_name, config)
    except FileNotFoundError:
        raise HTTPException(404, f"Plugin '{plugin_name}' not found")
    except PermissionError as e:
        raise HTTPException(403, str(e))
    return {"status": "activated", "name": plugin_name}

@router.post("/{plugin_name}/deactivate")
async def deactivate_plugin(plugin_name: str, user=Depends(require_admin)):
    """Deactivate a plugin (admin only)."""
    await plugin_manager.unload(plugin_name)
    return {"status": "deactivated", "name": plugin_name}

@router.get("/{plugin_name}/config")
async def get_plugin_config(plugin_name: str, user=Depends(get_current_user)):
    """Get plugin's current configuration."""
    plugin = plugin_manager.plugins.get(plugin_name)
    if not plugin:
        raise HTTPException(404, "Plugin not active")
    return {"name": plugin_name, "config": plugin.config}

@router.put("/{plugin_name}/config")
async def update_plugin_config(plugin_name: str, config: dict, user=Depends(require_admin)):
    """Update plugin configuration (requires re-activation)."""
    await plugin_manager.unload(plugin_name)
    await plugin_manager.load(plugin_name, config)
    return {"status": "reconfigured", "name": plugin_name}
```

### Step 5: Define Hook Points in Core System

```python
# backend/app/plugins/hooks.py
"""
Available hooks that plugins can register for.

Template hooks:
  - template.register        → Register custom templates at startup
  - template.list            → Modify template list before returning to user

Video hooks:
  - video.pre_render         → Modify render config before Remotion render
  - video.post_render        → Process video after render (watermark, encode)
  - video.pre_export         → Transform before final export

Job hooks:
  - job.created              → When a new job is created
  - job.completed            → When a job finishes successfully
  - job.failed               → When a job fails

Model hooks:
  - tts.voices               → Register additional TTS voices
  - llm.pre_prompt           → Modify LLM prompt before sending
  - llm.post_response        → Process LLM response

Integration hooks:
  - publish.platforms        → Register additional publish platforms
  - storage.providers        → Register additional storage backends
"""

VALID_HOOKS = {
    "template.register", "template.list",
    "video.pre_render", "video.post_render", "video.pre_export",
    "job.created", "job.completed", "job.failed",
    "tts.voices", "llm.pre_prompt", "llm.post_response",
    "publish.platforms", "storage.providers",
}
```

### Step 6: Example Plugin

```python
# plugins/openclip-reddit-template/main.py
from app.plugins.base import TemplatePlugin

class Plugin(TemplatePlugin):
    async def activate(self):
        pass

    async def deactivate(self):
        pass

    def get_templates(self):
        return [
            {
                "id": "reddit-dark",
                "name": "Reddit Story (Dark)",
                "description": "Dark mode Reddit story with upvote animations",
                "remotion_component": "RedditStoryDark",
                "preview_image": "preview.png",
                "config": {
                    "darkMode": self.config.get("darkMode", True),
                    "accentColor": self.config.get("accentColor", "#ff4500"),
                },
            }
        ]

    async def handle_template_register(self, data):
        return self.get_templates()
```

```json
// plugins/openclip-reddit-template/manifest.json
{
  "name": "openclip-reddit-template",
  "version": "1.0.0",
  "displayName": "Reddit Story Template",
  "description": "Custom Reddit story template with dark mode and upvote animations",
  "author": "community",
  "license": "MIT",
  "type": "template",
  "engine": "openclip >= 1.0.0",
  "entrypoint": "main.py",
  "hooks": ["template.register"],
  "permissions": ["storage:read"],
  "config": {
    "darkMode": { "type": "boolean", "default": true },
    "accentColor": { "type": "string", "default": "#ff4500" }
  }
}
```

## Best Practices
- **Permissions are explicit:** Plugins must declare all required permissions in manifest. Network access is scoped to specific domains.
- **Sandboxed execution:** Plugins run in a restricted environment. No direct filesystem access outside their directory. No arbitrary network calls beyond declared permissions.
- **Version constraints:** The `engine` field enforces compatibility. Plugins targeting `openclip >= 1.0.0` won't load on 0.x versions.
- **Fail gracefully:** If a plugin throws an error during hook execution, log it and continue. Never let a plugin crash the core system.
- **Admin-only activation:** Only admins can activate/deactivate plugins to prevent untrusted code execution.
- **Config validation:** Plugin configs are validated against the manifest schema before being passed to the plugin.

## Testing
- Create a test plugin → install → activate → verify hooks fire
- Test permission validation → plugin requesting disallowed permission → verify rejection
- Test plugin error handling → plugin throws in hook → verify core continues
- Test config update → change config → re-activate → verify new config applied
- Test uninstall → deactivate → verify hooks unregistered

## Verification Checklist
- [ ] Plugin discovery scans plugins directory correctly
- [ ] Manifest schema validation catches invalid plugins
- [ ] Permission system blocks unauthorized access
- [ ] Hooks fire and collect results from all registered plugins
- [ ] Plugin activation/deactivation works via API
- [ ] Plugin config is validated and applied
- [ ] Core system continues if a plugin throws an error
- [ ] Template plugins register templates visible in UI
- [ ] Admin-only access enforced for plugin management
- [ ] Example plugin loads and works end-to-end
