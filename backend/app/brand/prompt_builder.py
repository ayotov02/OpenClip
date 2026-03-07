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


def build_clip_scoring_prompt(ctx: BrandContext, transcript: str) -> str:
    return (
        f"Analyze this transcript and identify the top 10 most engaging "
        f"segments for {ctx.brand_name}'s audience.\n\n"
        f"Score each on: hook_strength, emotional_peak, info_density, "
        f"self_contained (0-100).\n"
        f"Consider the brand's voice: {', '.join(ctx.voice_traits)}.\n\n"
        f"Return JSON array: [{{start_time, end_time, score, title, reason}}]\n\n"
        f"Transcript:\n{transcript}"
    )


def build_publish_copy_prompt(
    ctx: BrandContext, clip_title: str, transcript: str, platform: str
) -> str:
    return (
        f"Generate publishing copy for {platform} for the clip '{clip_title}'.\n"
        f"Brand: {ctx.brand_name} ({ctx.niche}).\n"
        f"Voice: {', '.join(ctx.voice_traits)}.\n"
        f"Audience: {ctx.target_audience}.\n\n"
        f"Transcript:\n{transcript}\n\n"
        "Return JSON: {title, description, hashtags: list[str]}"
    )
