import type { CapacitorConfig } from '@capacitor/cli';

// Configuración de Capacitor (para empaquetar la app web como app de celular).
const config: CapacitorConfig = {
  // Id de la plantilla de Ionic: cambiarlo antes de publicar en una tienda
  appId: 'io.ionic.starter',
  appName: 'EVA_02_Drayer_Duran',
  // Carpeta que genera `ng build` / `ionic build` y que Capacitor copia a la app nativa
  webDir: 'www',
};

export default config;
