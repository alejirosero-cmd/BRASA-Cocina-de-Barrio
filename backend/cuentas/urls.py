from django.urls import path

from . import views

urlpatterns = [
    path('auth/registro', views.RegistroVista.as_view()),
    path('auth/login', views.LoginVista.as_view()),
    path('auth/recuperar', views.RecuperarVista.as_view()),
    path('auth/restablecer', views.RestablecerVista.as_view()),
    path('auth/config', views.ConfigVista.as_view()),
    path('auth/keycloak', views.LoginKeycloakVista.as_view()),
    path('auth/perfil', views.PerfilVista.as_view()),
    path('auth/cambiar-password', views.CambiarPasswordVista.as_view()),
    path('usuarios', views.UsuariosVista.as_view()),
    path('usuarios/<str:id>', views.UsuarioVista.as_view()),
]
