"""Private, offline screenshot OCR. Only the API container may reach this worker."""
import base64
import binascii
import hashlib
import io
import json
import os
import subprocess
import threading
import warnings
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from PIL import Image, UnidentifiedImageError

MAX_BYTES = 8 * 1024 * 1024
MAX_BODY = 4 * ((MAX_BYTES + 2) // 3) + 256
MAX_PIXELS = 20_000_000
MAX_TEXT = 20_000
Image.MAX_IMAGE_PIXELS = MAX_PIXELS
warnings.simplefilter('error', Image.DecompressionBombWarning)
SLOTS = threading.BoundedSemaphore(2)


def decode_image(data):
    if not isinstance(data, dict) or set(data) != {'imageBase64', 'mimeType'}:
        raise ValueError('Expected imageBase64 and mimeType only.')
    expected = {'image/png': 'PNG', 'image/jpeg': 'JPEG', 'image/webp': 'WEBP'}.get(data['mimeType']) if isinstance(data['mimeType'], str) else None
    encoded = data['imageBase64']
    if not expected or not isinstance(encoded, str) or not encoded or len(encoded) > 4 * ((MAX_BYTES + 2) // 3):
        raise ValueError('Upload a PNG, JPEG or WebP screenshot no larger than 8 MiB.')
    try:
        raw = base64.b64decode(encoded, validate=True)
    except (ValueError, binascii.Error) as exc:
        raise ValueError('Invalid base64 image.') from exc
    if len(raw) > MAX_BYTES:
        raise ValueError('Image exceeds 8 MiB.')
    try:
        with Image.open(io.BytesIO(raw)) as probe:
            if probe.format != expected or probe.width * probe.height > MAX_PIXELS or probe.width <= 0 or probe.height <= 0:
                raise ValueError('Image type or dimensions are unsupported.')
            if getattr(probe, 'n_frames', 1) != 1:
                raise ValueError('Animated images are unsupported.')
            probe.verify()
        with Image.open(io.BytesIO(raw)) as source:
            source.load()
            image = Image.new('RGB', source.size, 'white')
            if source.mode in ('RGBA', 'LA') or source.info.get('transparency') is not None:
                rgba = source.convert('RGBA')
                image.paste(rgba, mask=rgba.getchannel('A'))
            else:
                image.paste(source.convert('RGB'))
            clean = io.BytesIO()
            image.save(clean, format='PNG')
    except (UnidentifiedImageError, OSError, SyntaxError, Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
        raise ValueError('Invalid or oversized image.') from exc
    return clean.getvalue(), hashlib.sha256(raw).hexdigest()


def recognize(data):
    normalized, digest = decode_image(data)
    try:
        result = subprocess.run(
            ['tesseract', 'stdin', 'stdout', '-l', 'eng', '--psm', '6'],
            input=normalized, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
            timeout=30, check=True,
            env={'PATH': os.environ.get('PATH', '/usr/bin:/bin'), 'LANG': 'C.UTF-8', 'OMP_THREAD_LIMIT': '1'},
        )
    except subprocess.TimeoutExpired as exc:
        raise TimeoutError('OCR exceeded its time limit. Try a smaller crop.') from exc
    except (subprocess.CalledProcessError, FileNotFoundError) as exc:
        raise RuntimeError('OCR is unavailable.') from exc
    text = result.stdout.decode('utf-8', errors='replace').strip()
    return {'text': text[:MAX_TEXT], 'sha256': digest, 'engine': 'tesseract', 'truncated': len(text) > MAX_TEXT}


class Handler(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    def setup(self):
        super().setup()
        self.connection.settimeout(10)

    def log_message(self, *_):
        pass  # Never log request bodies, OCR text or filenames.

    def respond(self, code, data):
        body = json.dumps(data).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Connection', 'close')
        self.end_headers()
        self.wfile.write(body)
        self.close_connection = True

    def do_GET(self):
        self.respond(200 if self.path == '/health' else 404, {'ok': self.path == '/health'})

    def do_POST(self):
        if self.path != '/ocr':
            return self.respond(404, {'error': 'Not found.'})
        if not SLOTS.acquire(blocking=False):
            return self.respond(429, {'error': 'OCR is busy. Try again shortly.'})
        try:
            if self.headers.get('Transfer-Encoding') or self.headers.get('Content-Type', '').split(';')[0] != 'application/json':
                return self.respond(415, {'error': 'A JSON image upload is required.'})
            try:
                size = int(self.headers.get('Content-Length', '0'))
            except ValueError:
                return self.respond(400, {'error': 'Invalid content length.'})
            if not 0 < size <= MAX_BODY:
                return self.respond(413, {'error': 'Upload exceeds size limit.'})
            raw = self.rfile.read(size)
            if len(raw) != size:
                return self.respond(400, {'error': 'Incomplete upload.'})
            data = json.loads(raw)
            self.respond(200, recognize(data))
        except (ValueError, TypeError, UnicodeError):
            self.respond(400, {'error': 'Invalid image. Use a single PNG, JPEG or WebP under 8 MiB and 20 megapixels.'})
        except TimeoutError:
            self.respond(504, {'error': 'OCR timed out. Try a smaller crop.'})
        except RuntimeError:
            self.respond(503, {'error': 'OCR is unavailable.'})
        except (ConnectionError, OSError):
            pass
        finally:
            SLOTS.release()


if __name__ == '__main__':
    ThreadingHTTPServer(('0.0.0.0', 8080), Handler).serve_forever()
