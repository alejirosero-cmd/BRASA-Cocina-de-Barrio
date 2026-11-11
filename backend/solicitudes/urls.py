from django.urls import path

from . import views

urlpatterns = [
    path('solicitudes', views.SolicitudesVista.as_view()),
    path('solicitudes/<str:id>/atender', views.AtenderVista.as_view()),
]
