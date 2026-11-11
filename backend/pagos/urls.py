from django.urls import path

from . import views

urlpatterns = [
    path('pagos', views.PagosVista.as_view()),
    path('pagos/proveedor', views.ProveedorVista.as_view()),
    path('pagos/verificar', views.VerificarVista.as_view()),
    path('pagos/webhook/wompi', views.WebhookWompiVista.as_view()),
    path('pagos/simulado/<str:referencia>', views.SimuladoVista.as_view()),
    path('pagos/pedido/<str:pedido_id>', views.DelPedidoVista.as_view()),
    path('pagos/efectivo', views.EfectivoVista.as_view()),
    path('pagos/<str:id>/reembolso', views.ReembolsoVista.as_view()),
    path('pagos/<str:id>/reembolsado', views.ReembolsadoVista.as_view()),
]
