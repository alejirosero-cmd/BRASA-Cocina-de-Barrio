from rest_framework.response import Response
from rest_framework.views import APIView

from nucleo.limites import Limite, LimiteGeneral
from nucleo.serializadores import validar
from nucleo.vistas import VistaPublica, vista_roles

from . import serializers as s
from . import servicios
from .models import Usuario

ESTRICTO = [LimiteGeneral, Limite('estricto')]  # 5 intentos por minuto por IP


class RegistroVista(VistaPublica):
    throttle_classes = ESTRICTO

    def post(self, request):
        d = validar(s.Registro, request.data)
        return Response(servicios.registrar_cliente(d['email'], d['nombre'], d['password']), status=201)


class LoginVista(VistaPublica):
    throttle_classes = ESTRICTO

    def post(self, request):
        d = validar(s.Login, request.data)
        return Response(servicios.iniciar_sesion(d['email'], d['password']))


class RecuperarVista(VistaPublica):
    throttle_classes = ESTRICTO

    def post(self, request):
        servicios.solicitar_recuperacion(validar(s.SolicitarRecuperacion, request.data)['email'])
        return Response(
            {'mensaje': 'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.'}, status=202
        )


class RestablecerVista(VistaPublica):
    throttle_classes = ESTRICTO

    def post(self, request):
        d = validar(s.Restablecer, request.data)
        servicios.restablecer_password(d['token'], d['password'])
        return Response({'mensaje': 'Tu contraseña fue actualizada. Ya puedes iniciar sesión.'})


class PerfilVista(APIView):
    def get(self, request):
        return Response(request.user.publico())

    def patch(self, request):
        request.user.nombre = validar(s.ActualizarPerfil, request.data)['nombre']
        request.user.save(update_fields=['nombre', 'actualizado_en'])
        return Response(request.user.publico())


class CambiarPasswordVista(APIView):
    throttle_classes = ESTRICTO

    def post(self, request):
        d = validar(s.CambiarPassword, request.data)
        return Response(servicios.cambiar_password(request.user, d['actual'], d['nueva']))


class UsuariosVista(vista_roles('ADMIN')):
    def get(self, request):
        return Response([
            {**u.publico(), 'activo': u.activo, 'creadoEn': u.creado_en}
            for u in Usuario.objects.order_by('-creado_en')
        ])

    def post(self, request):
        return Response(servicios.crear_usuario(validar(s.CrearUsuario, request.data), request.user), status=201)


class UsuarioVista(vista_roles('ADMIN')):
    def patch(self, request, id):
        return Response(servicios.actualizar_usuario(id, validar(s.ActualizarUsuario, request.data), request.user))
