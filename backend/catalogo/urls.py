from django.urls import path

from . import views

urlpatterns = [
    path('productos', views.ProductosVista.as_view()),
    path('productos/categorias', views.CategoriasPublicasVista.as_view()),
    path('productos/admin/todos', views.ProductosAdminVista.as_view()),
    path('productos/admin/categorias', views.CategoriasAdminVista.as_view()),
    path('productos/categorias/<slug:slug>', views.CategoriaVista.as_view()),
    path('productos/<slug:slug>', views.ProductoVista.as_view()),
    path('productos/<slug:slug>/disponibilidad', views.DisponibilidadVista.as_view()),
]
