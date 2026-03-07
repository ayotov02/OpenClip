"""Faceless video template definitions and rendering configs."""

from typing import Any

TEMPLATES: dict[str, dict[str, Any]] = {
    "reddit_story": {
        "name": "Reddit Story",
        "description": "Dark background with Reddit-style card overlay and text scroll animation",
        "layout": "card_overlay",
        "background": {"type": "dark_gradient", "colors": ["#1A1A1B", "#0D0D0E"]},
        "text_style": {
            "font": "Inter",
            "size": 40,
            "color": "#D7DADC",
            "position": "center",
            "animation": "scroll_up",
        },
        "transitions": {"type": "fade", "duration": 0.5},
        "music_mood": "ambient",
        "pacing": "moderate",
        "scene_duration_default": 8,
        "aspect_ratio": "9:16",
    },
    "documentary": {
        "name": "Documentary Style",
        "description": "Ken Burns on B-roll, lower-third titles, ambient music",
        "layout": "fullscreen_broll",
        "background": {"type": "broll", "effect": "ken_burns"},
        "text_style": {
            "font": "Playfair Display",
            "size": 36,
            "color": "#FFFFFF",
            "position": "lower_third",
            "animation": "slide_in",
        },
        "transitions": {"type": "crossfade", "duration": 1.0},
        "music_mood": "cinematic",
        "pacing": "slow",
        "scene_duration_default": 10,
        "aspect_ratio": "16:9",
    },
    "listicle": {
        "name": "Top 10 Listicle",
        "description": "Numbered segments with transition effects and countdown",
        "layout": "numbered_cards",
        "background": {"type": "solid", "colors": ["#1E1E2E"]},
        "text_style": {
            "font": "Montserrat",
            "size": 48,
            "color": "#FFFFFF",
            "position": "center",
            "animation": "number_reveal",
            "number_color": "#FF6B35",
        },
        "transitions": {"type": "slide", "duration": 0.3},
        "music_mood": "upbeat",
        "pacing": "fast",
        "scene_duration_default": 6,
        "aspect_ratio": "9:16",
    },
    "motivational": {
        "name": "Motivational",
        "description": "Bold text overlays on nature/urban footage, cinematic music",
        "layout": "text_over_broll",
        "background": {"type": "broll", "effect": "slow_zoom"},
        "text_style": {
            "font": "Anton",
            "size": 64,
            "color": "#FFFFFF",
            "position": "center",
            "animation": "word_by_word",
            "highlight_color": "#FFD700",
        },
        "transitions": {"type": "zoom_fade", "duration": 0.8},
        "music_mood": "inspirational",
        "pacing": "moderate",
        "scene_duration_default": 7,
        "aspect_ratio": "9:16",
    },
    "scary_story": {
        "name": "Scary Story",
        "description": "Dark visuals, horror ambience, suspense pacing",
        "layout": "dark_atmosphere",
        "background": {"type": "dark_gradient", "colors": ["#0A0A0A", "#1A0A0A"]},
        "text_style": {
            "font": "Creepster",
            "size": 44,
            "color": "#CC0000",
            "position": "center",
            "animation": "flicker",
        },
        "transitions": {"type": "glitch", "duration": 0.4},
        "music_mood": "dark",
        "pacing": "slow",
        "scene_duration_default": 10,
        "aspect_ratio": "9:16",
    },
    "educational": {
        "name": "Educational Explainer",
        "description": "Clean layout, diagram placeholders, professional tone",
        "layout": "split_screen",
        "background": {"type": "solid", "colors": ["#FFFFFF"]},
        "text_style": {
            "font": "Roboto",
            "size": 36,
            "color": "#1A1A1A",
            "position": "bottom",
            "animation": "typewriter",
        },
        "transitions": {"type": "slide_horizontal", "duration": 0.5},
        "music_mood": "neutral",
        "pacing": "moderate",
        "scene_duration_default": 8,
        "aspect_ratio": "16:9",
    },
}


def get_templates() -> dict[str, dict[str, Any]]:
    """Return all available faceless video templates."""
    return TEMPLATES


def get_template(name: str) -> dict[str, Any]:
    """Get a template config by name, defaulting to 'educational'."""
    return TEMPLATES.get(name, TEMPLATES["educational"])


def get_template_list() -> list[dict[str, str]]:
    """Return a summary list of available templates for the picker UI."""
    return [
        {"id": key, "name": val["name"], "description": val["description"]}
        for key, val in TEMPLATES.items()
    ]
