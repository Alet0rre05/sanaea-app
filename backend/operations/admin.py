from django.contrib import admin

from operations.models import Holiday


@admin.register(Holiday)
class HolidayAdmin(admin.ModelAdmin):
    """Los feriados son datos de referencia globales: se cargan desde el admin de plataforma."""

    list_display = ["date", "name"]
    search_fields = ["name"]
