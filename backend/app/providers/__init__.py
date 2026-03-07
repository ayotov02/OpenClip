from app.providers.image_gen.flux import FluxImageGen
from app.providers.llm.ollama import OllamaLLM
from app.providers.music_gen.musicgen import LocalMusicGen
from app.providers.scraping.crawlee import CrawleeScraping
from app.providers.stt.whisperx import WhisperXSTT
from app.providers.tts.kokoro import KokoroTTS
from app.providers.upscaling.realesrgan import RealESRGANUpscaling
from app.providers.video_gen.wan import WanVideoGen


def get_llm_provider():
    return OllamaLLM()


def get_stt_provider():
    return WhisperXSTT()


def get_tts_provider():
    return KokoroTTS()


def get_image_gen_provider():
    return FluxImageGen()


def get_video_gen_provider():
    return WanVideoGen()


def get_music_gen_provider():
    return LocalMusicGen()


def get_upscaling_provider():
    return RealESRGANUpscaling()


def get_scraping_provider():
    return CrawleeScraping()
