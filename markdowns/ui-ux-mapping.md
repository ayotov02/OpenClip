# OpenClip UI/UX Mapping Plan

## Pages and Routes

1. / - Landing page with product overview, feature highlights, and get-started CTA
2. /dashboard - Main hub showing recent projects, active jobs, quick-create buttons, and usage stats
3. /projects - List of all clipping and faceless projects with status filters and search
4. /projects/new - Upload video or paste URL to start a new clipping project
5. /projects/:id - Single project view with generated clips, transcript, and export options
6. /projects/:id/editor - Timeline editor for trimming, reordering, and adjusting clips
7. /faceless - Faceless studio landing with template picker and recent faceless projects
8. /faceless/new - Create a new faceless video from text prompt, URL, or Reddit link
9. /faceless/:id - Single faceless project view with script, scenes, preview, and export
10. /faceless/:id/editor - Scene-by-scene editor for narration, B-roll, music, and captions
11. /brands - List of saved brand kits with previews
12. /brands/new - Create a new brand kit with logo, color, font, intro, outro, and audio uploads
13. /brands/:id - Edit an existing brand kit
14. /captions - Standalone caption generator for any uploaded video
15. /calendar - Content calendar with drag-and-drop scheduling grid
16. /publish - Publishing queue showing scheduled, in-progress, and completed posts
17. /analytics - Performance analytics dashboard for published content
18. /analytics/competitors - Competitor intelligence dashboard with scraped metrics
19. /analytics/trends - Trending topics and content patterns across platforms
20. /analytics/hashtags - Hashtag performance tracker and recommendations
21. /settings - App settings, API keys, connected social accounts, webhook config
22. /settings/accounts - Social media OAuth connections management
23. /settings/api - API key generation, usage logs, and webhook URLs
24. /settings/team - Team members, roles, and workspace management
25. /batch - Batch processing view for CSV upload and bulk job management
26. /templates - Template marketplace browser for community-shared templates
27. /docs - Embedded API documentation viewer

## Feature to UI Mapping

28. AI Video Clipping maps to /projects/new for upload, /projects/:id for results with clip cards showing virality score, thumbnail, duration, and download button
29. AI Clip Scoring surfaces as a virality score badge and ranking order on each clip card in /projects/:id, with a tooltip showing hook strength, emotion, density, and self-containedness breakdown
30. Caption System renders as a caption style picker panel in /projects/:id/editor and /faceless/:id/editor with live preview of each style applied to a sample frame
31. Inline Caption Editing appears as a clickable transcript overlay in the editor where users click any word to edit, rephrase, or delete caption segments
32. Faceless Video Studio maps to /faceless/new with a step wizard: choose template, enter topic or URL, configure voice and music, preview script, generate
33. Faceless Templates display as a visual grid of template cards on /faceless with preview thumbnails and short descriptions of each style
34. Script Generation shows as an editable JSON-backed scene list in /faceless/:id where each scene card has narration text, keyword tags, mood selector, and duration
35. TTS Integration surfaces as a voice picker dropdown in /faceless/new and /faceless/:id/editor with play buttons to preview each voice, plus speed and engine toggles
36. AI Reframing appears as an aspect ratio selector with mode toggle (auto, manual, split-screen, static) in /projects/:id/editor, with a live crop preview overlay on the video player
37. Face Detection and Tracking runs in the background during clipping and shows detected speaker bounding boxes on the video preview when reframing mode is active
38. AI B-Roll Integration surfaces as a B-roll panel in /faceless/:id/editor where each scene shows matched clips with swap, search, and manual override options
39. B-Roll Matching and Scoring shows as relevance scores on each B-roll candidate in the selection panel, sortable by score
40. Brand Kit System maps to /brands for CRUD list and /brands/new or /brands/:id for the editor with upload zones for logo, font files, intro/outro videos, color pickers, and audio stinger
41. Filler Word and Silence Removal appears as a toggle switch in /projects/:id/editor with a before/after waveform visualization highlighting removed segments
42. Video Editor UI is the full /projects/:id/editor page with a timeline track, playhead scrubber, trim handles, drag-to-reorder clips, layer controls, and a video preview player
43. REST API has no direct UI page but is configured in /settings/api where users generate keys, view docs link, and see request logs
44. Webhook System configures in /settings/api with a URL input field, event type checkboxes, and a test-send button with response log
45. Social Media Publishing maps to /publish with platform toggle buttons, AI-generated title/description/hashtag fields per platform, and a publish-now or schedule button
46. Content Calendar is the /calendar page with a monthly/weekly grid, draggable post cards, platform color coding, and click-to-edit scheduling
47. Auto-Posting runs as a background service with status indicators on /publish and /calendar showing scheduled, posting, published, or failed states
48. Competitor Intelligence Scraping configures in /analytics/competitors with an add-competitor form for platform and handle input, scrape frequency selector, and manual trigger button
49. Competitor Analytics Dashboard is /analytics/competitors showing charts for follower growth, engagement rates, posting frequency, top content, and side-by-side comparisons
50. Trending Content Detection displays on /analytics/trends as a feed of trending topics with platform badges, velocity indicators, and one-click create-video-from-trend buttons
51. Hashtag Analysis shows on /analytics/hashtags as a searchable table of hashtags with volume, growth, competition score, and a recommend-for-my-niche filter
52. Performance Analytics is /analytics with charts for views, likes, shares, comments, and follower growth per clip and per channel over time
53. MusicGen Integration surfaces as a music panel in /faceless/:id/editor with mood dropdown, duration slider, tempo control, generate button, and audio waveform preview with play
54. FLUX Thumbnail Generation appears as a thumbnail section in /projects/:id and /faceless/:id with prompt input, style selector, generate button, and a gallery of generated options to pick from
55. URL and Reddit Input Sources render as input tabs in /faceless/new with a URL field, Reddit link field, or paste-text area, each with a preview-extraction step before script generation
56. Batch Processing is the /batch page with a CSV upload dropzone, column mapping UI, job queue table showing progress bars per item, and bulk download when complete
57. Voice Cloning surfaces in the voice picker as a clone-voice option where users upload a reference audio file and name the cloned voice for reuse
58. AI Dubbing and Translation appears as a translate button on /projects/:id and /faceless/:id opening a language selector modal that triggers re-synthesis in the chosen language
59. Video Upscaling shows as an upscale toggle in the export settings panel with resolution target selector
60. Frame Interpolation appears as a slow-motion option in /projects/:id/editor with a speed factor slider applied to selected timeline segments
61. Multi-Camera Editing adds a camera-angle track to the timeline editor with angle switcher buttons synced to timecode
62. Team and Workspace Collaboration maps to /settings/team with member invite, role assignment dropdowns, and per-project permission toggles
63. Mobile Responsive UI applies globally as adaptive layouts, collapsible sidebars, bottom navigation on mobile, and touch-friendly controls across all pages
64. Plugin and Extension System surfaces in /settings as a plugins tab with an install-from-URL field, enabled/disabled toggles, and a link to the extension API docs
65. Community Template Marketplace is /templates with a browsable grid of community templates, install button, preview, and a publish-your-own upload flow

## Shared Components

66. Sidebar Navigation - Persistent left sidebar with links to Dashboard, Projects, Faceless, Brands, Calendar, Publish, Analytics, Batch, Templates, and Settings
67. Top Bar - Logo, search bar, notification bell with job completion alerts, and user avatar menu
68. Video Player - Reusable player component with play/pause, seek bar, fullscreen, aspect ratio preview, and caption overlay toggle
69. Upload Dropzone - Drag-and-drop file upload component with progress bar, format validation, and size limit display
70. Job Progress Indicator - Real-time progress bar with percentage, stage label, estimated time, and cancel button, powered by WebSocket updates
71. Toast Notifications - Non-blocking alerts for job completions, errors, and system messages
72. Modal Dialogs - Reusable modal for confirmations, form inputs, and preview overlays
73. Data Tables - Sortable, filterable, paginated tables used in projects list, batch view, analytics, and competitor data
74. Empty States - Illustrated placeholder screens for pages with no data, with contextual CTA buttons

## UX Flows

75. Clipping Flow - User lands on /dashboard, clicks new project, uploads video or pastes URL on /projects/new, waits for processing with live progress, reviews ranked clips on /projects/:id, optionally edits in /projects/:id/editor, exports or publishes
76. Faceless Flow - User clicks faceless on sidebar, picks a template on /faceless, enters topic or URL on /faceless/new, reviews and edits generated script on /faceless/:id, previews assembled video, generates thumbnail, exports or schedules
77. Brand Application Flow - User creates a brand kit on /brands/new, then when creating any project selects the brand kit from a dropdown, and all outputs automatically apply that kit's logo, colors, fonts, intro, outro, and caption style
78. Publishing Flow - User selects a completed clip, clicks publish, chooses platforms, reviews AI-generated titles and hashtags per platform, picks publish-now or drags onto /calendar for scheduling, monitors status on /publish
79. Competitor Research Flow - User adds competitor handles on /analytics/competitors, sets scrape frequency, views populated dashboards after first scrape, spots trends on /analytics/trends, and uses insights to inform new video topics
80. Batch Flow - User uploads CSV on /batch, maps columns to fields, submits bulk job, monitors individual progress bars, downloads all outputs when complete
