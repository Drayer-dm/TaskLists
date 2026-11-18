import { HttpErrorResponse } from '@angular/common/http';
import { TimeoutError } from 'rxjs';

/** Tipos de falla al hablar con un servicio web. La interfaz muestra un mensaje distinto para cada uno. */
export type ApiErrorKind = 'offline' | 'timeout' | 'unauthorized' | 'conflict' | 'invalid' | 'server';

export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Cualquier error (HTTP, timeout, datos inválidos) → ApiError con un mensaje para el usuario */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }
  if (error instanceof TimeoutError) {
    return new ApiError('timeout', 'El servidor tardó demasiado en responder.');
  }
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      return new ApiError('offline', 'Sin conexión con el servidor.');
    }
    if (error.status === 401 || error.status === 403) {
      return new ApiError(
        'unauthorized',
        'El servidor rechazó la cuenta: la contraseña no coincide con la registrada.',
      );
    }
    if (error.status === 412) {
      return new ApiError('conflict', 'Los datos cambiaron en el servidor mientras se enviaban.');
    }
    if (error.status === 400 || error.status === 413 || error.status === 422) {
      return new ApiError('invalid', 'El servidor rechazó los datos enviados.');
    }
    if (error.status === 429) {
      return new ApiError('server', 'Demasiadas solicitudes: intenta en un momento.');
    }
    return new ApiError('server', `Error del servidor (${error.status}).`);
  }
  return new ApiError('server', 'Error inesperado al comunicarse con el servidor.');
}
