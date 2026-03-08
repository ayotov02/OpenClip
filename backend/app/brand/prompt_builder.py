from app.models.brand_context import BrandContext


def build_brand_system_prompt(ctx: BrandContext) -> str:
    return (
        f'You are creating content for "{ctx.brand_name}", a {ctx.niche} channel.\n'
        f"Voice: {', '.join(ctx.voice_traits)}.\n"
        f"Audience: {ctx.target_audience}.\n"
        f"Goals: {', '.join(ctx.goals)}.\n"
        f"Differentiator: {ctx.uniqueness}.\n"
        f"Platforms: {', '.join(ctx.platforms)} ({ctx.posting_frequency}).\n"
        "Always match this brand's tone, vocabulary, and content style."
    )


def build_clip_scoring_prompt(
    ctx: BrandContext, transcript: str
) -> tuple[str, str]:
    system_prompt = build_brand_system_prompt(ctx)
    user_prompt = (
        f"Analyze this transcript and identify the top 10 most engaging "
        f"segments for {ctx.brand_name}'s audience.\n\n"
        f"Score each on: hook_strength, emotional_peak, info_density, "
        f"self_contained (0-100).\n"
        f"Consider the brand's voice: {', '.join(ctx.voice_traits)}.\n\n"
        f"Return JSON: {{\"clips\": [{{\"start_time\": float, \"end_time\": float, "
        f"\"score\": int, \"title\": str, \"reason\": str}}]}}\n\n"
        f"Transcript:\n{transcript}"
    )
    return system_prompt, user_prompt


def build_publish_copy_prompt(
    ctx: BrandContext, clip_title: str, transcript: str, platform: str
) -> tuple[str, str]:
    system_prompt = build_brand_system_prompt(ctx)
    user_prompt = (
        f"Generate publishing copy for {platform} for the clip '{clip_title}'.\n"
        f"Brand: {ctx.brand_name} ({ctx.niche}).\n"
        f"Voice: {', '.join(ctx.voice_traits)}.\n"
        f"Audience: {ctx.target_audience}.\n\n"
        f"Transcript:\n{transcript}\n\n"
        "Return JSON: {\"title\": str, \"description\": str, \"hashtags\": [str]}"
    )
    return system_prompt, user_prompt


def build_post_analysis_prompt(
    brand_ctx: object | None,
    caption: str,
    platform: str,
    post_type: str,
    engagement_rate: float,
    likes: int,
    views: int,
) -> tuple[str, str]:
    if brand_ctx and hasattr(brand_ctx, "brand_name"):
        system_prompt = (
            build_brand_system_prompt(brand_ctx)
            + "\n\nYou are also a content intelligence analyst. "
            "Analyze competitor content to extract actionable insights."
        )
        niche_ref = f" in the {brand_ctx.niche} niche"
    else:
        system_prompt = (
            "You are a content intelligence analyst specializing in social media. "
            "Analyze content to extract actionable insights for creators."
        )
        niche_ref = ""

    user_prompt = (
        f"Analyze this {platform} {post_type}{niche_ref}.\n\n"
        f"Caption/Text:\n{caption}\n\n"
        f"Metrics: {likes:,} likes, {views:,} views, {engagement_rate:.2%} ER\n\n"
        "Score each dimension 0-100 and extract key elements.\n"
        "Return JSON:\n"
        "{\n"
        '  "hook_score": float,\n'
        '  "body_score": float,\n'
        '  "cta_score": float,\n'
        '  "extracted_hook": "the opening hook text or description",\n'
        '  "extracted_cta": "the call-to-action text",\n'
        '  "content_category": "educational|entertainment|promotional|storytelling|tutorial",\n'
        '  "sentiment": "positive|negative|neutral",\n'
        '  "sentiment_confidence": float,\n'
        '  "niche_relevance": float,\n'
        '  "analysis_summary": "2-3 sentence analysis of what makes this content effective or not"\n'
        "}"
    )
    return system_prompt, user_prompt


def build_similar_script_prompt(
    brand_ctx: object,
    original_caption: str,
    platform: str,
    extracted_hook: str,
    extracted_cta: str,
    content_category: str,
) -> tuple[str, str]:
    system_prompt = build_brand_system_prompt(brand_ctx)
    user_prompt = (
        f"Generate a {platform} script inspired by this competitor content, "
        f"but rewritten in our brand voice.\n\n"
        f"Original caption:\n{original_caption}\n\n"
        f"Hook used: {extracted_hook}\n"
        f"CTA used: {extracted_cta}\n"
        f"Category: {content_category}\n\n"
        "Create a new, original script that captures the same engagement pattern "
        "but uses our brand voice and positioning.\n\n"
        "Return JSON:\n"
        "{\n"
        '  "title": "video title",\n'
        '  "hook": "opening hook (first 3 seconds)",\n'
        '  "body": "main content script",\n'
        '  "cta": "call to action",\n'
        '  "hashtags": ["relevant", "hashtags"],\n'
        '  "estimated_duration_seconds": int,\n'
        '  "visual_suggestions": ["suggestion1", "suggestion2"]\n'
        "}"
    )
    return system_prompt, user_prompt
