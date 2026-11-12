from django.db import migrations, models


def meseros_actuales_cobran(apps, schema_editor):
    """Los meseros que ya existían seguían cobrando en la mesa: conservan ese permiso."""
    apps.get_model('cuentas', 'Usuario').objects.filter(rol='MESERO').update(puede_cobrar=True)


class Migration(migrations.Migration):

    dependencies = [
        ('cuentas', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='usuario',
            name='puede_cobrar',
            field=models.BooleanField(default=False),
        ),
        migrations.RunPython(meseros_actuales_cobran, migrations.RunPython.noop),
    ]
