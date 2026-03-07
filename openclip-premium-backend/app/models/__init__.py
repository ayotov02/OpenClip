from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


# Import all models so Alembic can discover them
from app.models.api_key import UserApiKey  # noqa: E402, F401
from app.models.asset import CreativeAsset  # noqa: E402, F401
from app.models.batch import BatchItem, BatchJob  # noqa: E402, F401
from app.models.brand_context import BrandContext  # noqa: E402, F401
from app.models.brand_kit import BrandKit  # noqa: E402, F401
from app.models.calendar import CalendarEvent  # noqa: E402, F401
from app.models.clip import Clip  # noqa: E402, F401
from app.models.competitor import Competitor, CompetitorMetric  # noqa: E402, F401
from app.models.faceless import FacelessProject, FacelessScene  # noqa: E402, F401
from app.models.hashtag import Hashtag  # noqa: E402, F401
from app.models.job import Job  # noqa: E402, F401
from app.models.project import Project  # noqa: E402, F401
from app.models.publish import PublishJob  # noqa: E402, F401
from app.models.social_account import SocialAccount  # noqa: E402, F401
from app.models.trend import TrendingTopic  # noqa: E402, F401
from app.models.user import User  # noqa: E402, F401
from app.models.webhook import WebhookConfig  # noqa: E402, F401
