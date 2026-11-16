"""Remote4K Bridge.

Servidor que corre en una PC de la misma red que el Apple TV. Hace tres cosas:

1. API (/api/*): descubre, empareja y controla el Apple TV usando pyatv.
2. Sirve la app web/PWA ya compilada (carpeta ../dist) en la raíz "/".
3. Página de instalación (/install) a la que apunta el QR: en iPhone explica
   cómo agregar la PWA a la pantalla de inicio, en Android ofrece el APK
   (bridge/downloads/remote4k.apk o el último GitHub Release) o la versión web.

Ejecutar:  python main.py   (o start-bridge.ps1 desde la raíz del proyecto)
"""

from __future__ import annotations

import asyncio
import html
import json
import os
import random
import re
import socket
import time
import urllib.request
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Dict, Optional

import pyatv
import segno
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, Response
from pydantic import BaseModel
from pyatv import exceptions as pyatv_exceptions
from pyatv.const import FeatureName, FeatureState, InputAction, KeyboardFocusState, PowerState, Protocol
from pyatv.interface import DeviceListener

BASE_DIR = Path(__file__).resolve().parent
STORAGE_FILE = BASE_DIR / "remote4k_storage.json"
WEB_DIR = Path(os.environ.get("REMOTE4K_WEB_DIR", BASE_DIR.parent / "dist")).resolve()
APK_FILE = BASE_DIR / "downloads" / "remote4k.apk"
PORT = int(os.environ.get("REMOTE4K_PORT", "8000"))
SCAN_TIMEOUT = 5

@asynccontextmanager
async def lifespan(_app):
    yield
    for device_id in list(connections):
        await close_connection(device_id)


app = FastAPI(title="Remote4K Bridge", lifespan=lifespan)

# Red local / uso interno: permitimos cualquier origen para poder desarrollar
# con `expo start --web` (puerto 8081) apuntando a este bridge.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Almacenamiento de credenciales
# ---------------------------------------------------------------------------
# Formato: { "<identifier>": {"name", "address", "protocol", "credentials"} }
# Versiones anteriores guardaban por IP: { "<ip>": {"protocol", "credentials"} };
# esas entradas se migran solas la primera vez que se ve el dispositivo.


def _load_storage() -> Dict[str, Dict[str, str]]:
    if not STORAGE_FILE.exists():
        return {}
    try:
        data = json.loads(STORAGE_FILE.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


saved: Dict[str, Dict[str, str]] = _load_storage()


def _persist() -> None:
    STORAGE_FILE.write_text(json.dumps(saved, indent=2), encoding="utf-8")


def _is_legacy_key(key: str) -> bool:
    return "address" not in saved.get(key, {})


def _migrate_legacy(conf) -> None:
    """Si existe una entrada antigua guardada por IP, la re-asigna al identificador."""
    ident = conf.identifier
    address = str(conf.address)
    if ident in saved:
        if saved[ident].get("address") != address or saved[ident].get("name") != conf.name:
            saved[ident]["address"] = address
            saved[ident]["name"] = conf.name
            _persist()
        return
    if address in saved and _is_legacy_key(address):
        entry = saved.pop(address)
        entry.update({"name": conf.name, "address": address})
        saved[ident] = entry
        _persist()


# ---------------------------------------------------------------------------
# Utilidades pyatv
# ---------------------------------------------------------------------------

PROTOCOLS = {
    "COMPANION": Protocol.Companion,
    "AIRPLAY": Protocol.AirPlay,
    "MRP": Protocol.MRP,
    "DMAP": Protocol.DMAP,
}
# Companion es el que permite control remoto + encendido en tvOS modernos.
PROTOCOL_PREFERENCE = ["COMPANION", "AIRPLAY", "MRP", "DMAP"]


def _proto_name(protocol) -> str:
    value = str(protocol).upper()
    return value.split(".", 1)[1] if value.startswith("PROTOCOL.") else value


def _is_apple_tv(conf) -> bool:
    protos = {_proto_name(s.protocol) for s in conf.services}
    model = str(getattr(conf.device_info, "model", "")).lower()
    return "COMPANION" in protos or "MRP" in protos or "appletv" in model.replace(" ", "")


async def _scan(**kwargs):
    return await pyatv.scan(asyncio.get_running_loop(), timeout=SCAN_TIMEOUT, **kwargs)


async def find_device(device_id: str):
    """Busca un Apple TV por identificador (y por IP guardada si el multicast falla)."""
    atvs = await _scan(identifier=device_id)
    if not atvs:
        address = saved.get(device_id, {}).get("address")
        if address:
            atvs = [a for a in await _scan(hosts=[address]) if device_id in a.all_identifiers]
    if not atvs:
        return None
    conf = atvs[0]
    _migrate_legacy(conf)
    return conf


class CommandError(Exception):
    """Error que no se arregla reconectando (comando/feature no soportado, etc.)."""


class _ConnectionListener(DeviceListener):
    def __init__(self, device_id: str, atv):
        self.device_id = device_id
        self.atv = atv

    def connection_lost(self, exception: Exception) -> None:
        _drop_connection(self.device_id, self.atv)

    def connection_closed(self) -> None:
        _drop_connection(self.device_id, self.atv)


connections: Dict[str, object] = {}
connection_locks: Dict[str, asyncio.Lock] = {}
pairings: Dict[str, object] = {}
muted_volume: Dict[str, float] = {}


def _drop_connection(device_id: str, atv=None) -> None:
    current = connections.get(device_id)
    if current is not None and (atv is None or current is atv):
        connections.pop(device_id, None)


async def close_connection(device_id: str) -> None:
    atv = connections.pop(device_id, None)
    if atv is not None:
        try:
            atv.close()
        except Exception:
            pass


async def get_connection(device_id: str, force: bool = False):
    lock = connection_locks.setdefault(device_id, asyncio.Lock())
    async with lock:
        if force:
            await close_connection(device_id)
        if device_id in connections:
            return connections[device_id]

        stored = saved.get(device_id)
        if not stored:
            raise CommandError("Este Apple TV no está emparejado")

        conf = await find_device(device_id)
        if conf is None:
            raise CommandError("No se encontró el Apple TV en la red. ¿Está encendido y en la misma red?")

        protocol = PROTOCOLS[stored["protocol"]]
        service = conf.get_service(protocol)
        if service is None:
            raise CommandError(f"El Apple TV no expone el servicio {stored['protocol']}")
        service.credentials = stored["credentials"]

        atv = await pyatv.connect(conf, asyncio.get_running_loop())
        atv.listener = _ConnectionListener(device_id, atv)
        connections[device_id] = atv
        return atv


def _feature_available(atv, feature: FeatureName) -> bool:
    try:
        return atv.features.in_state(FeatureState.Available, feature)
    except Exception:
        return False


async def _toggle_power(atv) -> None:
    state = atv.power.power_state
    if state == PowerState.Off:
        await atv.power.turn_on()
    else:
        await atv.power.turn_off()


async def _toggle_mute(device_id: str, atv) -> None:
    if not _feature_available(atv, FeatureName.SetVolume):
        raise CommandError("Silenciar no está disponible: el Apple TV no controla el volumen de tu TV/receptor")
    current = atv.audio.volume
    if current > 0:
        muted_volume[device_id] = current
        await atv.audio.set_volume(0.0)
    else:
        await atv.audio.set_volume(muted_volume.pop(device_id, 30.0))


COMMANDS = {
    "up": lambda atv: atv.remote_control.up(),
    "down": lambda atv: atv.remote_control.down(),
    "left": lambda atv: atv.remote_control.left(),
    "right": lambda atv: atv.remote_control.right(),
    "select": lambda atv: atv.remote_control.select(),
    "select_hold": lambda atv: atv.remote_control.select(InputAction.Hold),
    "menu": lambda atv: atv.remote_control.menu(),
    "top_menu": lambda atv: atv.remote_control.top_menu(),
    "home": lambda atv: atv.remote_control.home(),
    "home_hold": lambda atv: atv.remote_control.home_hold(),
    "play_pause": lambda atv: atv.remote_control.play_pause(),
    "skip_forward": lambda atv: atv.remote_control.skip_forward(),
    "skip_backward": lambda atv: atv.remote_control.skip_backward(),
    "volume_up": lambda atv: atv.audio.volume_up(),
    "volume_down": lambda atv: atv.audio.volume_down(),
    "power": _toggle_power,
    "power_on": lambda atv: atv.power.turn_on(),
    "power_off": lambda atv: atv.power.turn_off(),
}


async def run_on_device(device_id: str, action):
    """Ejecuta `action(atv)`; si la conexión estaba caída reconecta y reintenta una vez."""
    atv = await get_connection(device_id)
    try:
        return await action(atv)
    except (CommandError, pyatv_exceptions.NotSupportedError):
        raise
    except Exception:
        atv = await get_connection(device_id, force=True)
        return await action(atv)


def _error(message: str, status: int = 200) -> JSONResponse:
    return JSONResponse({"ok": False, "error": message}, status_code=status)


# ---------------------------------------------------------------------------
# API
# ---------------------------------------------------------------------------


class DeviceBody(BaseModel):
    id: str


class CommandBody(DeviceBody):
    command: str


class TextBody(DeviceBody):
    text: str


class PairStartBody(DeviceBody):
    protocol: Optional[str] = None


class PairFinishBody(DeviceBody):
    pin: str = ""


@app.get("/api/health")
def health():
    return {"ok": True, "service": "remote4k-bridge"}


@app.get("/api/info")
def info():
    base = lan_base_url()
    return {
        "ok": True,
        "url": base,
        "install_url": f"{base}/install",
        "apk_url": apk_download_url(),
        "web_available": (WEB_DIR / "index.html").exists(),
    }


@app.get("/api/devices")
async def list_devices():
    devices = []
    seen = set()
    for conf in await _scan():
        if not _is_apple_tv(conf) or conf.identifier in seen:
            continue
        seen.add(conf.identifier)
        _migrate_legacy(conf)
        protos = [_proto_name(s.protocol) for s in conf.services]
        devices.append(
            {
                "id": conf.identifier,
                "name": conf.name,
                "address": str(conf.address),
                "deep_sleep": conf.deep_sleep,
                "paired": conf.identifier in saved,
                "protocols": protos,
            }
        )
    return {"ok": True, "devices": devices}


@app.get("/api/paired")
def paired_devices():
    return {
        "ok": True,
        "devices": [
            {"id": k, "name": v.get("name", k), "address": v.get("address", k), "protocol": v.get("protocol")}
            for k, v in saved.items()
        ],
    }


@app.post("/api/pair/start")
async def pair_start(body: PairStartBody):
    conf = await find_device(body.id)
    if conf is None:
        return _error("No se encontró el Apple TV en la red")

    available = [_proto_name(s.protocol) for s in conf.services]
    requested = (body.protocol or "").upper() or next((p for p in PROTOCOL_PREFERENCE if p in available), None)
    if requested not in available or requested not in PROTOCOLS:
        return _error(f"Protocolo no disponible ({requested}). Disponibles: {', '.join(available)}")

    old = pairings.pop(body.id, None)
    if old is not None:
        try:
            await old.close()
        except Exception:
            pass

    try:
        pairing = await pyatv.pair(conf, PROTOCOLS[requested], asyncio.get_running_loop())
        await pairing.begin()
    except Exception as e:
        return _error(f"No se pudo iniciar el emparejamiento: {e}")

    pairings[body.id] = pairing
    generated_pin = None
    if not pairing.device_provides_pin:
        generated_pin = random.randint(1000, 9999)
        pairing.pin(generated_pin)

    return {
        "ok": True,
        "protocol": requested,
        "device_provides_pin": pairing.device_provides_pin,
        "generated_pin": generated_pin,
    }


@app.post("/api/pair/finish")
async def pair_finish(body: PairFinishBody):
    pairing = pairings.pop(body.id, None)
    if pairing is None:
        return _error("No hay un emparejamiento en curso. Vuelve a iniciarlo.")
    try:
        if pairing.device_provides_pin:
            if not body.pin.strip().isdigit():
                pairings[body.id] = pairing
                return _error("Escribe el PIN de 4 dígitos que aparece en la TV")
            pairing.pin(int(body.pin.strip()))
        await pairing.finish()

        service = pairing.service
        if not pairing.has_paired or not service or not service.credentials:
            return _error("El Apple TV rechazó el emparejamiento. Revisa el PIN e inténtalo de nuevo.")

        conf = await find_device(body.id)
        saved[body.id] = {
            "name": conf.name if conf else body.id,
            "address": str(conf.address) if conf else "",
            "protocol": _proto_name(service.protocol),
            "credentials": service.credentials,
        }
        _persist()
        await close_connection(body.id)
        return {"ok": True}
    except Exception as e:
        return _error(f"Error al emparejar: {e}")
    finally:
        try:
            await pairing.close()
        except Exception:
            pass


@app.post("/api/connect")
async def connect(body: DeviceBody):
    """Abre (o reutiliza) la conexión para que el primer botón responda al instante."""
    try:
        await get_connection(body.id)
        return {"ok": True}
    except CommandError as e:
        return _error(str(e))
    except Exception as e:
        return _error(f"No se pudo conectar con el Apple TV: {e}")


@app.post("/api/command")
async def command(body: CommandBody):
    name = body.command
    if name == "mute":
        action = lambda atv: _toggle_mute(body.id, atv)  # noqa: E731
    elif name in COMMANDS:
        action = COMMANDS[name]
    else:
        return _error(f"Comando no soportado: {name}")

    try:
        await run_on_device(body.id, action)
        return {"ok": True, "command": name}
    except pyatv_exceptions.NotSupportedError:
        return _error("Este comando no está disponible con el protocolo emparejado")
    except CommandError as e:
        return _error(str(e))
    except Exception as e:
        return _error(f"No se pudo enviar el comando: {e}")


@app.post("/api/text")
async def send_text(body: TextBody):
    async def action(atv):
        if not _feature_available(atv, FeatureName.TextSet):
            raise CommandError("El teclado no está disponible con este emparejamiento")
        if atv.keyboard.text_focus_state != KeyboardFocusState.Focused:
            raise CommandError("Abre primero un campo de texto (búsqueda, usuario...) en la TV")
        await atv.keyboard.text_set(body.text)

    try:
        await run_on_device(body.id, action)
        return {"ok": True}
    except CommandError as e:
        return _error(str(e))
    except Exception as e:
        return _error(f"No se pudo enviar el texto: {e}")


@app.post("/api/forget")
async def forget(body: DeviceBody):
    await close_connection(body.id)
    saved.pop(body.id, None)
    _persist()
    return {"ok": True}


@app.api_route("/api/{rest:path}", methods=["GET", "POST"])
def api_not_found(rest: str):
    return _error("Ruta de API no encontrada", 404)


# ---------------------------------------------------------------------------
# Instalación: QR, landing y APK
# ---------------------------------------------------------------------------


def lan_ip() -> str:
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("10.255.255.255", 1))  # no envía paquetes; solo elige la interfaz
        return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"
    finally:
        s.close()


def lan_base_url() -> str:
    return f"http://{lan_ip()}:{PORT}"


def qr_svg(data: str) -> str:
    return segno.make(data, error="m").svg_inline(scale=8, border=2, dark="#000", light="#fff")


# ---------------------------------------------------------------------------
# APK: archivo local (bridge/downloads) o último release de GitHub
# ---------------------------------------------------------------------------

APK_URL_ENV = os.environ.get("REMOTE4K_APK_URL", "").strip()
_apk_cache: Dict[str, object] = {"url": None, "checked": 0.0, "source": None}


def github_release_apk_url() -> Optional[str]:
    """URL del APK del último release, deducida del remoto 'origin' del repo."""
    git_config = BASE_DIR.parent / ".git" / "config"
    try:
        text = git_config.read_text(encoding="utf-8")
    except OSError:
        return None
    section = re.search(r'\[remote "origin"\]([^\[]*)', text)
    if not section:
        return None
    match = re.search(r"url\s*=\s*\S*github\.com[:/]([^/\s]+)/([^\s]+?)(?:\.git)?/?\s*$", section.group(1), re.M)
    if not match:
        return None
    owner, repo = match.groups()
    return f"https://github.com/{owner}/{repo}/releases/latest/download/remote4k.apk"


def _url_exists(url: str) -> bool:
    try:
        req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "remote4k-bridge"})
        with urllib.request.urlopen(req, timeout=5) as res:
            return res.status == 200
    except Exception:
        return False


def apk_download_url() -> Optional[str]:
    """Dónde descargar el APK, o None si no hay. Lo remoto se revisa cada 10 min."""
    if APK_FILE.exists():
        return "/download/remote4k.apk"
    source = APK_URL_ENV or github_release_apk_url()
    if not source:
        return None
    now = time.monotonic()
    ttl = 600 if _apk_cache["url"] else 60  # sin release todavía: reintenta antes
    if _apk_cache["source"] != source or now - float(_apk_cache["checked"]) > ttl:
        _apk_cache.update(source=source, checked=now, url=source if _url_exists(source) else None)
    return _apk_cache["url"]  # type: ignore[return-value]


@app.get("/download/remote4k.apk")
def download_apk():
    if not APK_FILE.exists():
        raise HTTPException(404, "APK no disponible todavía")
    return FileResponse(
        APK_FILE,
        media_type="application/vnd.android.package-archive",
        filename="Remote4K.apk",
    )


@app.get("/qr", response_class=HTMLResponse)
def qr_page():
    install = f"{lan_base_url()}/install"
    return _page(
        "Remote4K · QR",
        f"""
        <h1>Escanea con tu celular</h1>
        <p class="muted">Tu celular debe estar en la misma red Wi-Fi.</p>
        <div class="qr">{qr_svg(install)}</div>
        <p class="mono">{html.escape(install)}</p>
        """,
    )


@app.get("/install", response_class=HTMLResponse)
def install_page(request: Request):
    base = str(request.base_url).rstrip("/")
    if request.url.hostname in {"localhost", "127.0.0.1", "::1"}:
        base = lan_base_url()  # el QR debe apuntar a la IP de la red, no a localhost
    apk = apk_download_url()
    setup_link = f"remote4k://setup?bridge={base}"
    apk_block = (
        f"""
        <a class="btn primary" href="{html.escape(apk or '')}">Descargar app (APK)</a>
        <ol class="steps">
          <li>Abre el archivo descargado y permite <b>instalar apps desconocidas</b> si Android lo pide.</li>
          <li>Instala y vuelve aquí.</li>
          <li><a href="{html.escape(setup_link)}">Toca aquí para conectar la app a este bridge</a>.</li>
        </ol>
        <a class="btn" href="/">Usar versión web sin instalar</a>
        """
        if apk
        else """
        <a class="btn primary" href="/">Abrir control</a>
        <ol class="steps">
          <li>Abre el menú <b>⋮</b> de Chrome.</li>
          <li>Toca <b>Agregar a la pantalla principal</b>.</li>
        </ol>
        """
    )
    return _page(
        "Instalar Remote4K",
        f"""
        <img class="logo" src="/apple-touch-icon.png" alt="">
        <h1>Remote4K</h1>
        <p class="muted">Control para Apple TV</p>

        <section data-os="ios">
          <ol class="steps">
            <li>Abre esta página en <b>Safari</b>.</li>
            <li>Toca <b>Compartir</b> <span class="ico">⬆︎</span> en la barra.</li>
            <li>Elige <b>Agregar a pantalla de inicio</b> y toca <b>Agregar</b>.</li>
            <li>Abre <b>Remote4K</b> desde tu pantalla de inicio.</li>
          </ol>
          <a class="btn" href="/">Abrir sin instalar</a>
        </section>

        <section data-os="android">{apk_block}</section>

        <section data-os="desktop">
          <p>Escanea este código con tu iPhone o Android:</p>
          <div class="qr">{qr_svg(base + "/install")}</div>
          <a class="btn" href="/">Abrir control aquí</a>
        </section>

        <script>
          (function () {{
            var ua = navigator.userAgent;
            var ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
            var android = /Android/i.test(ua);
            if (ios && navigator.standalone) {{ location.replace('/'); return; }}
            var os = ios ? 'ios' : android ? 'android' : 'desktop';
            document.querySelectorAll('section[data-os]').forEach(function (s) {{
              s.style.display = s.getAttribute('data-os') === os ? 'block' : 'none';
            }});
          }})();
        </script>
        """,
    )


def _page(title: str, body: str) -> str:
    return f"""<!doctype html>
<html lang="es"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#000000">
<link rel="manifest" href="/manifest.json">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<title>{html.escape(title)}</title>
<style>
  :root {{ color-scheme: dark; }}
  * {{ box-sizing: border-box; }}
  body {{ margin:0; min-height:100vh; background:#000; color:#fff;
         font:16px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
         display:flex; flex-direction:column; align-items:center; text-align:center;
         padding: calc(env(safe-area-inset-top) + 40px) 20px 40px; }}
  main {{ width:100%; max-width:420px; }}
  h1 {{ margin:8px 0 2px; font-size:30px; }}
  .muted {{ color:#98989f; margin:0 0 24px; }}
  .logo {{ display:block; width:72px; height:72px; margin:0 auto; border-radius:18px;
          border:1px solid #2a2b30; }}
  .steps {{ text-align:left; background:#121316; border:1px solid #1f2024; border-radius:20px;
           padding:18px 18px 18px 40px; margin:16px 0; color:#d8d8dc; }}
  .steps li {{ margin:6px 0; }}
  .steps a {{ color:#7ab8ff; }}
  .ico {{ display:inline-block; padding:0 6px; border-radius:6px; background:#2a2b30; }}
  .btn {{ display:block; padding:15px; border-radius:16px; margin:12px 0; text-decoration:none;
         font-weight:700; background:#1a1b1f; border:1px solid #2a2b30; color:#fff; }}
  .btn.primary {{ background:#f2f2f4; color:#0c0c0d; border-color:#f2f2f4; }}
  .qr {{ background:#fff; border-radius:20px; padding:12px; display:inline-block; margin:12px 0; }}
  .qr svg {{ display:block; width:min(70vw, 280px); height:auto; }}
  .mono {{ font-family: ui-monospace, Consolas, monospace; color:#98989f; word-break:break-all; }}
  section[data-os] {{ display:none; }}
</style></head>
<body><main>{body}</main></body></html>"""


# ---------------------------------------------------------------------------
# App web (PWA) compilada con `npm run build:web`
# ---------------------------------------------------------------------------

NO_CACHE = {"Cache-Control": "no-cache"}


@app.get("/{path:path}")
def web_app(path: str):
    if not (WEB_DIR / "index.html").exists():
        return HTMLResponse(
            _page(
                "Remote4K",
                "<h1>Falta compilar la app web</h1>"
                "<p class='muted'>En la carpeta del proyecto ejecuta <b>npm run build:web</b> y recarga.</p>",
            ),
            status_code=503,
        )

    clean = path.strip("/")
    candidates = [clean, f"{clean}.html", f"{clean}/index.html"] if clean else ["index.html"]
    for candidate in candidates:
        target = (WEB_DIR / candidate).resolve()
        if target.is_file() and target.is_relative_to(WEB_DIR):
            if "/_expo/static/" in target.as_posix():
                headers = {"Cache-Control": "public, max-age=31536000, immutable"}  # nombres con hash
            else:
                headers = NO_CACHE
            return FileResponse(target, headers=headers)

    # Rutas desconocidas → la app decide (SPA)
    return FileResponse(WEB_DIR / "index.html", headers=NO_CACHE)


def _print_banner() -> None:
    install = f"{lan_base_url()}/install"
    print("\n  Remote4K Bridge")
    print(f"  Control:     {lan_base_url()}/")
    print(f"  Instalar:    {install}")
    print(f"  QR en la PC: http://localhost:{PORT}/qr")
    apk = apk_download_url()
    if apk:
        print(f"  APK:         {'local (bridge/downloads)' if apk.startswith('/') else apk}")
    else:
        print("  APK:         no encontrado (ni en bridge/downloads ni en GitHub Releases)")
    print(f"  App web:     {'OK' if (WEB_DIR / 'index.html').exists() else 'falta compilar → npm run build:web'}\n")
    try:
        segno.make(install, error="m").terminal(compact=True)
    except Exception:
        pass
    print()


if __name__ == "__main__":
    import uvicorn

    _print_banner()
    uvicorn.run(app, host="0.0.0.0", port=PORT, log_level="info")
