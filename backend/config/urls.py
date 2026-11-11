from django.urls import include, path

urlpatterns = [
    path('api/', include('cuentas.urls')),
    path('api/', include('catalogo.urls')),
    path('api/', include('mesas.urls')),
    path('api/', include('pedidos.urls')),
    path('api/', include('solicitudes.urls')),
    path('api/', include('pagos.urls')),
    path('api/', include('calificaciones.urls')),
    path('api/', include('reportes.urls')),
]
