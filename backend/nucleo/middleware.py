class CabecerasSeguridadMiddleware:
    """Cabeceras de seguridad equivalentes a las de helmet en la versión anterior."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        respuesta = self.get_response(request)
        respuesta.setdefault('X-Content-Type-Options', 'nosniff')
        respuesta.setdefault('Cross-Origin-Resource-Policy', 'same-site')
        respuesta.setdefault('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'")
        respuesta.setdefault('X-DNS-Prefetch-Control', 'off')
        return respuesta
