# Remote4K

Control para Apple TV desde el celular. Uso interno.

## Cómo funciona

```
 Celular (PWA iPhone / web o APK Android)
        │  HTTP en la red local
        ▼
 PC con el bridge (Python + pyatv, puerto 8000)
        │  protocolos de Apple (Companion)
        ▼
 Apple TV
```

Un celular no puede hablar directo con el Apple TV desde el navegador, así que una PC de la
misma red corre el **bridge** (`bridge/main.py`). El bridge:

- expone la API `/api/*` (buscar, emparejar, mandar comandos y texto),
- sirve la app web/PWA en `http://<ip-de-la-pc>:8000/`,
- sirve la página de instalación `/install` (a la que apunta el QR),
- sirve el APK en `/download/remote4k.apk` si existe `bridge/downloads/remote4k.apk`.

La PC tiene que estar encendida para usar el control.

## Puesta en marcha (una vez)

Requisitos: Node 20+ y Python 3.10+ en la PC.

```bash
npm install
```

```bash
npm run build:web
```

```bash
npm run bridge
```

`npm run bridge` crea el entorno de Python la primera vez e imprime la URL y un **QR** en la
terminal. También puedes abrir `http://localhost:8000/qr` en la PC para ver el QR en grande.

> La primera vez Windows pide permiso de firewall para Python: acepta en **redes privadas**.
> Si el celular no carga la página, revisa que la red Wi-Fi esté marcada como privada.

## Instalar en el celular

Escanea el QR con la cámara. La página `/install` detecta el sistema:

- **iPhone**: en Safari toca Compartir → *Agregar a pantalla de inicio*. Se abre a pantalla
  completa como una app.
- **Android**: si hay APK, botón *Descargar app*; después de instalarla, toca el enlace
  *conectar la app a este bridge* (configura la IP sola). Sin APK, usa la versión web y
  *Agregar a la pantalla principal* desde Chrome.

Luego: elige el Apple TV → *Emparejar* → escribe el PIN que sale en la TV. Queda guardado; las
siguientes veces la app abre directo el control.

## Generar el APK de Android

### Con GitHub (recomendado)

El workflow `.github/workflows/android-apk.yml` compila el APK en GitHub Actions y lo publica en
**Releases** como `remote4k.apk`. Se ejecuta al subir un tag `v*` o a mano desde
*Actions → Android APK → Run workflow*.

```bash
git tag v1.0.0
```

```bash
git push origin v1.0.0
```

El bridge lee el remoto `origin` del repo y ofrece en `/install` la descarga desde
`https://github.com/<usuario>/<repo>/releases/latest/download/remote4k.apk`. El repo tiene que
ser **público** para que el celular pueda descargarlo sin iniciar sesión. Para usar otra URL,
define la variable de entorno `REMOTE4K_APK_URL`.

### Alternativas

- Archivo local: si existe `bridge/downloads/remote4k.apk`, el bridge lo sirve y tiene prioridad.
- Expo EAS (`npm run build:apk`, requiere cuenta de Expo): guarda el `.apk` resultante en
  `bridge/downloads/remote4k.apk`.

## El control

| Gesto | Acción |
| --- | --- |
| Tocar aro (arriba/abajo/izq/der) | Mover |
| Mantener en el aro | Repetir movimiento |
| Deslizar sobre el touchpad | Mover (deslizamientos largos avanzan varias posiciones) |
| Tocar centro / mantener centro | Seleccionar / menú contextual |
| ‹ / mantener ‹ | Atrás / menú principal de la app |
| TV / mantener TV | Inicio / Centro de control |
| Volumen +/− (mantener repite), silenciar, play/pausa, encendido | Lo que dicen |
| Botón teclado (arriba) | Escribir en el campo de búsqueda abierto en la TV |

Volumen y silencio solo funcionan si el Apple TV controla el volumen de tu TV/receptor
(HDMI-CEC o IR configurado en el Apple TV).

## Desarrollo

```bash
npm run web
```

Con el bridge corriendo, en desarrollo web la app apunta a sí misma; para usar el bridge en otro
puerto crea `.env.local` con `EXPO_PUBLIC_BRIDGE_URL=http://localhost:8000`.

- `app/` pantallas (expo-router): `devices`, `pair`, `remote`, `settings`, `setup` (deep link
  `remote4k://setup?bridge=...`).
- `src/services/api.ts` cliente del bridge; `src/store/useRemoteStore.tsx` estado persistido.
- `public/` manifest, service worker e iconos de la PWA.
- `bridge/remote4k_storage.json` guarda las credenciales de emparejamiento (no se sube a git).
