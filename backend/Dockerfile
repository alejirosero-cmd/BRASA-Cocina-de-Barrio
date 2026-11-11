# API de BRASA (Django REST Framework) servida con Gunicorn.
FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

# Usuario sin privilegios: el proceso no corre como root.
RUN useradd --create-home --uid 10001 brasa && chown -R brasa /app
USER brasa

EXPOSE 8000
# Un solo proceso con varios hilos: el tiempo real (SSE) usa un bus en memoria compartido.
CMD ["sh", "-c", "python manage.py migrate --noinput && python manage.py sembrar && gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 1 --worker-class gthread --threads 50 --timeout 120 --access-logfile -"]
