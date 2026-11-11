from django.urls import path

from . import views

urlpatterns = [path('reportes/resumen', views.ResumenVista.as_view())]
