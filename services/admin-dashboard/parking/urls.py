from django.urls import path
from django.conf import settings
from django.conf.urls.static import static
from . import views

urlpatterns = [
    path('', views.dashboard, name='dashboard'),
    # path('export-monthly-csv/', views.export_monthly_csv, name='export_monthly_csv'),
    # path('export-all-csv/', views.export_all_csv, name='export_all_csv'),

]
if settings.DEBUG:  # only in development
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)



 