"""Vercel-funktion: PDF in, Markdown ut — motorn bakom PDF-importen i editorn.

Konverteringen bygger på pymupdf4llm, som känner igen rubriknivåer via
teckenstorlek samt listor och tabeller. Koden är hämtad från skrivbordsverktyget
pdf2md (core.py) och anpassad för att köras utan filsystem.

Anropas ett sidintervall i taget:

    POST /api/pdf2md
    { "url": "<Appwrite-fil>", "start": 0, "count": 8, "headers": {…} }
    → { "pages": 42, "headers": {…}, "markdown": "…", "next": 8 }

Klienten loopar tills "next" är null och räknar progress som start/pages. Att
dela upp arbetet håller varje anrop inom Vercels tidsgräns och ger en exakt
progressbar utan att svaret behöver strömmas.

"headers" är rubrikskalan (teckenstorlek → nivå). Den räknas ut från hela
dokumentet i första anropet och skickas sedan tillbaka av klienten, dels för att
slippa läsa om alla sidor varje gång, dels för att alla sidintervall ska få
samma rubriknivåer.

Bilder hoppas över: de skulle behöva laddas upp till Appwrite för att kunna
visas, och det gör importen inte i dag.
"""

from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler

import pymupdf
from pymupdf4llm.helpers.pymupdf_rag import IdentifyHeaders, to_markdown

# Sidor per anrop när klienten inte säger något annat. Sidor bearbetas oberoende
# av varandra, så resultatet blir identiskt med en konvertering i ett svep.
DEFAULT_COUNT = 8
MAX_COUNT = 25
# En PDF som är större än så tar för lång tid i en serverlös funktion.
MAX_BYTES = 40 * 1024 * 1024
FETCH_TIMEOUT = 20


class Failure(Exception):
    """Fel som användaren ska få se ordagrant."""

    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


class _Headers:
    """Återskapar rubrikskalan från klienten utan att läsa om dokumentet.

    Har samma två metoder som pymupdf4llm:s IdentifyHeaders, vilket är allt
    to_markdown() rör.
    """

    def __init__(self, body_limit: float, header_id: dict):
        self.body_limit = float(body_limit)
        self.header_id = {int(size): tag for size, tag in header_id.items()}

    def get_header_id(self, span: dict, page=None) -> str:
        size = round(span["size"])
        if size <= self.body_limit:
            return ""
        return self.header_id.get(size, "")


def _allowed_host() -> str:
    endpoint = os.environ.get("VITE_APPWRITE_ENDPOINT", "")
    host = urllib.parse.urlparse(endpoint).hostname
    if not host:
        raise Failure(500, "Servern saknar VITE_APPWRITE_ENDPOINT")
    return host


def verify_caller(jwt: str) -> None:
    """Bara inloggade redaktörer får konvertera — annars är det en öppen
    beräkningstjänst för vem som helst."""
    if not jwt:
        raise Failure(401, "Saknar token")

    endpoint = os.environ.get("VITE_APPWRITE_ENDPOINT", "").rstrip("/")
    project = os.environ.get("VITE_APPWRITE_PROJECT_ID", "")
    if not endpoint or not project:
        raise Failure(500, "Servern saknar Appwrite-konfiguration")

    request = urllib.request.Request(
        f"{endpoint}/account",
        headers={"X-Appwrite-Project": project, "X-Appwrite-JWT": jwt},
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            json.load(response)
    except Exception as exc:  # utgången session, fel projekt, nätet nere …
        raise Failure(401, "Ogiltig eller utgången session") from exc


def fetch_pdf(url: str) -> bytes:
    """Hämtar filen från Appwrite. Bara den egna storagen tillåts — annars vore
    funktionen ett verktyg för att läsa vad som helst från nätet (SSRF)."""
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != "https" or parsed.hostname != _allowed_host():
        raise Failure(400, "Länken måste peka på en fil i projektets Appwrite-storage")

    try:
        with urllib.request.urlopen(url, timeout=FETCH_TIMEOUT) as response:
            data = response.read(MAX_BYTES + 1)
    except urllib.error.HTTPError as exc:
        raise Failure(400, f"Filen kunde inte hämtas ({exc.code})") from exc
    except Exception as exc:
        raise Failure(400, "Filen kunde inte hämtas") from exc

    if len(data) > MAX_BYTES:
        raise Failure(413, "PDF:en är större än 40 MB")
    return data


def convert(data: bytes, start: int, count: int, headers: dict | None) -> dict:
    try:
        doc = pymupdf.open(stream=data, filetype="pdf")
    except Exception as exc:
        raise Failure(400, "Inte en läsbar PDF") from exc

    try:
        if doc.needs_pass:
            raise Failure(400, "PDF:en är lösenordsskyddad")
        total = doc.page_count
        if total == 0:
            raise Failure(400, "PDF:en innehåller inga sidor")
        if start >= total:
            raise Failure(400, "Sidan finns inte i dokumentet")

        # Rubriknivåer bygger på teckenstorlekar i hela dokumentet. Räknas en
        # gång och återanvänds, annars får varje intervall sin egen skala.
        scale = _Headers(**headers) if headers else IdentifyHeaders(doc)

        pages = list(range(start, min(start + count, total)))
        markdown = to_markdown(
            doc,
            pages=pages,
            hdr_info=scale,
            page_separators=False,
            write_images=False,
            show_progress=False,
        )
        next_start = pages[-1] + 1
        return {
            "pages": total,
            "headers": {"body_limit": scale.body_limit, "header_id": scale.header_id},
            "markdown": tidy(markdown),
            "next": next_start if next_start < total else None,
        }
    finally:
        doc.close()


_HEADING = re.compile(r"^(#{1,6})\s+(.*)$")
_BOLD = re.compile(r"\*\*|__")
_LIST_ITEM = re.compile(r"^(\s*)(?:[-*+]|\d+[.)])\s+\S")
# pymupdf4llm markerar text med bakgrundsfärg som <mark>. I tryckta dokument är
# det nästan alltid sidhuvuden och färgplattor, inte överstrykningar.
_MARK = re.compile(r"</?mark>")


def tidy(markdown: str) -> str:
    """Städa upp råoutputen: pymupdf4llm är noggrann men inte alltid snygg."""
    markdown = _MARK.sub("", markdown.replace("\r\n", "\n"))
    lines = [line.rstrip() for line in markdown.split("\n")]
    lines = _dedent_lists(lines)

    out: list[str] = []
    for line in lines:
        heading = _HEADING.match(line)
        if heading:
            hashes, text = heading.groups()
            # Fetstil i en rubrik säger inget extra. Ta bort den överallt i
            # raden, inte bara när den omsluter hela – radbrutna rubriker blir
            # annars "Titel:** **Fortsättning** **Slut".
            text = _BOLD.sub("", text)
            text = re.sub(r"\s{2,}", " ", text).strip()
            line = f"{hashes} {text}".rstrip()

            # Rubriker behöver luft över sig för att renderas rätt överallt.
            if out and out[-1] != "":
                out.append("")

        elif out and out[-1] == "" and _LIST_ITEM.match(line):
            # Slå ihop glesa listor: tomrader mellan punkter gör listan "loose",
            # vilket lägger till <p>-taggar runt varje punkt vid rendering.
            previous = next((item for item in reversed(out) if item != ""), None)
            if previous is not None and _LIST_ITEM.match(previous):
                while out and out[-1] == "":
                    out.pop()

        out.append(line)

    text = "\n".join(out)
    text = re.sub(r"\n{3,}", "\n\n", text)  # aldrig mer än en tom rad
    return text.strip() + "\n"


def _dedent_lists(lines: list[str]) -> list[str]:
    """Ta bort gemensam indentering på listrader utan att förlora nivåerna."""
    indents = [
        len(match.group(1))
        for line in lines
        if (match := _LIST_ITEM.match(line)) and line.strip()
    ]
    shift = min(indents, default=0)
    if shift == 0:
        return lines

    return [
        line[shift:] if _LIST_ITEM.match(line) and line[:shift].isspace() else line
        for line in lines
    ]


def handle(body: dict, jwt: str) -> dict:
    verify_caller(jwt)

    url = str(body.get("url") or "")
    if not url:
        raise Failure(400, "url krävs")

    try:
        start = max(0, int(body.get("start") or 0))
        count = int(body.get("count") or DEFAULT_COUNT)
    except (TypeError, ValueError) as exc:
        raise Failure(400, "start och count måste vara tal") from exc

    headers = body.get("headers")
    if headers is not None and not isinstance(headers, dict):
        raise Failure(400, "headers måste vara ett objekt")

    return convert(fetch_pdf(url), start, min(max(1, count), MAX_COUNT), headers)


class handler(BaseHTTPRequestHandler):
    def do_POST(self):  # noqa: N802 — namnet krävs av BaseHTTPRequestHandler
        try:
            length = int(self.headers.get("content-length") or 0)
            body = json.loads(self.rfile.read(length) or b"{}")
            if not isinstance(body, dict):
                raise Failure(400, "Ogiltig förfrågan")
            jwt = re.sub(r"^Bearer\s+", "", self.headers.get("authorization") or "", flags=re.I).strip()
            self._send(200, handle(body, jwt))
        except Failure as failure:
            self._send(failure.status, {"error": failure.message})
        except json.JSONDecodeError:
            self._send(400, {"error": "Ogiltig förfrågan"})
        except Exception as exc:  # oväntat – logga hela felet, visa en rad
            print(f"pdf2md: {type(exc).__name__}: {exc}")
            self._send(500, {"error": "Konverteringen misslyckades"})

    def _send(self, status: int, payload: dict) -> None:
        data = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "application/json; charset=utf-8")
        self.send_header("content-length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)
