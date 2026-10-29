/** Respuesta paginada del backend (pedidos y postulaciones). */
export interface Paginated<T> {
  total: number;
  items: T[];
  /** Cantidad por estado sobre toda la tabla (no depende de la página ni del filtro). */
  counts: Record<string, number>;
}

/** Lo que devuelven los hooks: la respuesta del backend + la página (base 0) que se pidió.
 *  Sirve para que "Mostrando X–Y" siempre coincida con los ítems que se ven, incluso
 *  mientras se carga la página siguiente (placeholderData). */
export type PageResult<T> = Paginated<T> & { page: number };

export const PAGE_SIZE = 10;
