from app.crud.base import CRUDBase
from app.models import BlogPost, PortfolioItem, Service

services = CRUDBase(Service)
portfolio_items = CRUDBase(PortfolioItem)
blog_posts = CRUDBase(BlogPost)
