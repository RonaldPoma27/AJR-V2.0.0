class AppError(Exception):
    """Error de regla de negocio. main.py lo traduce a una respuesta HTTP."""

    def __init__(self, status_code: int, detail: str) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail
