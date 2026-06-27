"""glamour URL Configuration — serves both API and frontend pages."""

from django.contrib import admin
from django.urls import path, include
from django.views.generic import TemplateView
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('makeup.urls')),
    path('api/users/', include('users.urls')),

    # Frontend pages served by Django
    path('', TemplateView.as_view(template_name='index.html'), name='home'),
    path('camera/', TemplateView.as_view(template_name='camera.html'), name='camera'),
    path('database/', TemplateView.as_view(template_name='database.html'), name='database'),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
