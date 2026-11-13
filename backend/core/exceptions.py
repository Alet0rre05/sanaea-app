class CrossTenantWriteError(Exception):
    """Se intentó guardar un registro asignado a un tenant distinto del activo."""


class ImmutableRecordError(Exception):
    """Se intentó modificar o borrar un registro de auditoría inmutable."""


class TenantNotSetError(Exception):
    """Se intentó una operación que requiere un tenant activo y no hay ninguno."""
