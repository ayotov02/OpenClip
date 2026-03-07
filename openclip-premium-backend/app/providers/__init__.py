from app.providers.image_gen.kieai_image import KieAIImageGen
from app.providers.llm.openrouter import OpenRouterLLM
from app.providers.music_gen.kieai_music import KieAIMusicGen
from app.providers.scraping.brightdata import BrightDataScraping
from app.providers.stt.kieai_stt import KieAISTT
from app.providers.tts.kieai_tts import KieAITTS
from app.providers.upscaling.kieai_upscale import KieAIUpscaling
from app.providers.video_gen.kieai_video import KieAIVideoGen


def get_llm_provider():
    return OpenRouterLLM()


def get_stt_provider():
    return KieAISTT()


def get_tts_provider():
    return KieAITTS()


def get_image_gen_provider():
    return KieAIImageGen()


def get_video_gen_provider():
    return KieAIVideoGen()


def get_music_gen_provider():
    return KieAIMusicGen()


def get_upscaling_provider():
    return KieAIUpscaling()


def get_scraping_provider():
    return BrightDataScraping()
