from django.urls import path

from . import views

urlpatterns = [
    path('pedidos', views.PedidosVista.as_view()),
    path('pedidos/cotizar', views.CotizarVista.as_view()),
    path('pedidos/activos', views.ActivosVista.as_view()),
    path('pedidos/mios', views.MiosVista.as_view()),
    path('pedidos/eventos', views.EventosPersonalVista.as_view()),
    path('pedidos/<str:id>', views.PedidoVista.as_view()),
    path('pedidos/<str:id>/eventos', views.EventosPedidoVista.as_view()),
    path('pedidos/<str:id>/estado', views.EstadoVista.as_view()),
    path('pedidos/<str:id>/cancelar', views.CancelarVista.as_view()),
    path('pedidos/<str:id>/propina', views.PropinaVista.as_view()),
    path('pedidos/<str:id>/factura', views.FacturaVista.as_view()),
]
