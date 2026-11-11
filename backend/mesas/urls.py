from django.urls import path

from . import views

urlpatterns = [
    path('mesas', views.MesasVista.as_view()),
    path('mesas/codigo/<str:codigo>', views.ResolverCodigoVista.as_view()),
    path('mesas/<str:id>', views.MesaVista.as_view()),
    path('mesas/<str:id>/regenerar-codigo', views.RegenerarCodigoVista.as_view()),
    path('mesas/<str:id>/qr.svg', views.QrVista.as_view()),
]
