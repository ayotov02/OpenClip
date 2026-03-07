# Automation Integrations (n8n / Zapier) — Implementation Guide

## Overview
- **What:** Enable integration with n8n (self-hosted, open-source Zapier alternative) and Zapier via webhooks, providing example workflows for common automation scenarios.
- **Why:** Automation multiplies the value of OpenClip. Creators can build "autopilot" workflows: new YouTube video → auto-clip → post to TikTok.
- **Dependencies:** Phase 4 Feature 9 (Webhooks), Phase 2 Feature 8 (REST API)

## Architecture

### Integration Points
```
OpenClip → Webhooks → n8n/Zapier (triggers)
n8n/Zapier → REST API → OpenClip (actions)

Triggers (outgoing webhooks):
  - job.completed → Clip finished processing
  - video.published → Video posted to platform
  - batch.completed → Batch run finished

Actions (incoming API calls):
  - POST /projects → Create clipping project
  - POST /faceless → Create faceless video
  - POST /publish → Publish to social platform
  - GET /jobs/{id} → Check job status
```

### n8n Custom Node (Optional)
```
openclip-n8n-node/
├── package.json
├── nodes/
│   └── OpenClip/
│       ├── OpenClip.node.ts       # Node definition
│       └── OpenClipApi.credentials.ts  # API key credential
└── README.md
```

## Step-by-Step Implementation

### Step 1: Document API for Automation
Create a dedicated automation section in API docs:
```python
# Tag all automation-relevant endpoints
@router.post("/projects", tags=["automation"])
@router.post("/faceless", tags=["automation"])
@router.post("/publish", tags=["automation"])
@router.get("/jobs/{id}", tags=["automation"])
```

### Step 2: Create n8n Webhook Trigger Node (Community)
```typescript
// OpenClip.node.ts
import { INodeType, INodeTypeDescription } from "n8n-workflow";

export class OpenClip implements INodeType {
  description: INodeTypeDescription = {
    displayName: "OpenClip",
    name: "openClip",
    group: ["trigger"],
    version: 1,
    description: "Trigger on OpenClip events",
    defaults: { name: "OpenClip Trigger" },
    inputs: [],
    outputs: ["main"],
    credentials: [{ name: "openClipApi", required: true }],
    webhooks: [{ name: "default", httpMethod: "POST", responseMode: "onReceived", path: "webhook" }],
    properties: [
      {
        displayName: "Event",
        name: "event",
        type: "options",
        options: [
          { name: "Job Completed", value: "job.completed" },
          { name: "Video Published", value: "video.published" },
          { name: "Batch Completed", value: "batch.completed" },
        ],
        default: "job.completed",
      },
    ],
  };
}
```

### Step 3: Create Example Workflows

**Example 1: YouTube → Clips → TikTok**
```json
{
  "name": "Auto-Clip YouTube to TikTok",
  "nodes": [
    {"type": "webhook", "name": "YouTube Upload Trigger"},
    {"type": "http", "name": "Create OpenClip Project", "method": "POST", "url": "{{API_URL}}/projects"},
    {"type": "http", "name": "Poll Job Status", "method": "GET", "url": "{{API_URL}}/jobs/{{jobId}}"},
    {"type": "http", "name": "Publish to TikTok", "method": "POST", "url": "{{API_URL}}/publish"}
  ]
}
```

**Example 2: RSS Feed → Faceless Videos**
```json
{
  "name": "RSS to Faceless Video",
  "nodes": [
    {"type": "rssFeed", "name": "RSS Trigger", "url": "https://news.ycombinator.com/rss"},
    {"type": "http", "name": "Create Faceless Video", "method": "POST", "url": "{{API_URL}}/faceless"},
    {"type": "openClipWebhook", "name": "Wait for Completion"},
    {"type": "http", "name": "Publish to YouTube", "method": "POST", "url": "{{API_URL}}/publish"}
  ]
}
```

### Step 4: Create Documentation Page
Create `docs/guides/automation.md` with:
- n8n setup instructions
- Zapier webhook configuration
- Example workflow screenshots
- API authentication setup
- Common workflow templates

## Best Practices
- **n8n over Zapier for self-hosted users:** n8n is open-source and self-hosted, aligning with OpenClip's philosophy.
- **Polling fallback:** For platforms that can't receive webhooks, provide a polling-based workflow using GET /jobs/{id}.
- **Idempotency keys:** Include idempotency keys in automation requests to prevent duplicate video creation.
- **Rate limiting awareness:** Document rate limits clearly so automation workflows respect them.

## Testing
- Set up n8n locally → configure OpenClip webhook trigger → verify events received
- Create a full workflow: webhook trigger → API action → verify end-to-end
- Test Zapier webhook integration

## Verification Checklist
- [ ] Webhooks trigger n8n workflows correctly
- [ ] API actions (create project, faceless, publish) callable from n8n
- [ ] Example workflow JSONs importable into n8n
- [ ] Zapier webhook integration works
- [ ] Documentation covers setup for both n8n and Zapier
- [ ] Idempotency keys prevent duplicate operations
- [ ] Rate limiting documented for automation use cases
