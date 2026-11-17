export interface Task {
  id: number;
  title: string;
  description: string;
  /** Fecha y hora en que se creó la tarea (hora local del dispositivo). */
  createdAt: Date;
  location?: TaskLocation;
}

/** Largos máximos. Los usan el ion-input (maxlength) y addTask() (validación final),
    así ambos lados aplican exactamente el mismo límite. */
export const TASK_LIMITS = {
  title: 60,
  description: 200,
} as const;

//Datos a llamar para la localicacion
export interface TaskLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
}
