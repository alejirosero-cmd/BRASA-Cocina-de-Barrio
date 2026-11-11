from django.urls import path

from . import views

urlpatterns = [
    path('calificaciones', views.CalificacionesVista.as_view()),
    path('calificaciones/resumen', views.ResumenVista.as_view()),
]
