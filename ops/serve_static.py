#!/usr/bin/env python3
import argparse
import functools
import json
import mimetypes
import os
import smtplib
import ssl
import time
from email.message import EmailMessage
from email.utils import formatdate
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse


LEAD_RECIPIENT = os.environ.get("ROBOTPSA_LEAD_EMAIL", "doctormail@yandex.ru")
LEAD_SENDER = os.environ.get("ROBOTPSA_LEAD_FROM", "robotpsa.ru <noreply@robotpsa.ru>")
SMTP_HOSTS = [
    host.strip()
    for host in os.environ.get("ROBOTPSA_SMTP_HOSTS", "mx.yandex.ru,mx.yandex.net").split(",")
    if host.strip()
]
SMTP_TIMEOUT = float(os.environ.get("ROBOTPSA_SMTP_TIMEOUT", "12"))
LEAD_QUEUE_PATH = os.environ.get("ROBOTPSA_LEAD_QUEUE", "/var/lib/robotpsa/leads.jsonl")
MAX_LEAD_BODY = 64 * 1024


class StaticHandler(SimpleHTTPRequestHandler):
    def list_directory(self, path):
        self.send_error(HTTPStatus.NOT_FOUND, "Not found")
        return None

    def end_headers(self):
        parsed_path = urlparse(self.path).path
        if parsed_path.startswith("/api/"):
            self.send_header("Cache-Control", "no-store")
        elif parsed_path.startswith("/assets/"):
            self.send_header("Cache-Control", "public, max-age=604800")
        else:
            self.send_header("Cache-Control", "public, max-age=300")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def do_GET(self):
        if self.path in ("", "/"):
            self.path = "/index.html"
        return super().do_GET()

    def do_HEAD(self):
        if self.path in ("", "/"):
            self.path = "/index.html"
        return super().do_HEAD()

    def do_OPTIONS(self):
        if urlparse(self.path).path != "/api/lead":
            self.send_error(HTTPStatus.NOT_FOUND, "Not found")
            return
        self.send_response(HTTPStatus.NO_CONTENT)
        self.send_header("Allow", "POST, OPTIONS")
        self.end_headers()

    def do_POST(self):
        if urlparse(self.path).path != "/api/lead":
            self.send_error(HTTPStatus.NOT_FOUND, "Not found")
            return

        accepts_json = "application/json" in self.headers.get("Accept", "")

        try:
            lead = self._read_lead()
            if lead.get("website"):
                self._send_lead_success(accepts_json)
                return
            self._validate_lead(lead)
            queued = self._queue_lead(lead)
            mail_sent = self._try_send_lead_email(lead)
            if not queued and not mail_sent:
                raise RuntimeError("Lead was not queued or emailed")
        except ValueError as exc:
            self._send_lead_error(str(exc), HTTPStatus.BAD_REQUEST, accepts_json)
            return
        except Exception as exc:
            self.log_error("lead delivery failed: %s: %s", type(exc).__name__, exc)
            self._send_lead_error("Не удалось отправить заявку", HTTPStatus.BAD_GATEWAY, accepts_json)
            return

        self._send_lead_success(accepts_json, queued=queued, mail_sent=mail_sent)

    def _read_lead(self):
        content_length = int(self.headers.get("Content-Length", "0") or "0")
        if content_length <= 0:
            raise ValueError("Пустая заявка")
        if content_length > MAX_LEAD_BODY:
            raise ValueError("Слишком большой размер заявки")

        raw_body = self.rfile.read(content_length)
        content_type = self.headers.get("Content-Type", "").split(";", 1)[0].strip().lower()

        if content_type == "application/json":
            data = json.loads(raw_body.decode("utf-8"))
            if not isinstance(data, dict):
                raise ValueError("Некорректная заявка")
            return {str(key): self._clean_value(value) for key, value in data.items()}

        if content_type in ("application/x-www-form-urlencoded", ""):
            parsed = parse_qs(raw_body.decode("utf-8"), keep_blank_values=True)
            return {key: self._clean_value(values[-1] if values else "") for key, values in parsed.items()}

        raise ValueError("Неподдерживаемый формат заявки")

    @staticmethod
    def _clean_value(value):
        if value is None:
            return ""
        if isinstance(value, (list, tuple)):
            value = ", ".join(str(item) for item in value)
        value = str(value).replace("\x00", "").strip()
        return value[:2000]

    @staticmethod
    def _validate_lead(lead):
        required_fields = {
            "company": "Компания",
            "name": "Ваше имя",
            "contact": "Телефон или Telegram",
            "volume": "Примерный объем",
            "consent": "Согласие",
        }
        missing = [label for field, label in required_fields.items() if not lead.get(field)]
        if missing:
            raise ValueError("Заполните поля: " + ", ".join(missing))

    def _queue_lead(self, lead):
        record = {
            "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "remote_addr": self.client_address[0] if self.client_address else "",
            "user_agent": self.headers.get("User-Agent", ""),
            "lead": {
                key: lead.get(key, "")
                for key in (
                    "company",
                    "name",
                    "contact",
                    "volume",
                    "calculator",
                    "page",
                    "referrer",
                    "source",
                    "site",
                )
            },
        }
        line = (json.dumps(record, ensure_ascii=False) + "\n").encode("utf-8")

        try:
            queue_dir = os.path.dirname(LEAD_QUEUE_PATH)
            if queue_dir:
                os.makedirs(queue_dir, mode=0o700, exist_ok=True)
            fd = os.open(LEAD_QUEUE_PATH, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o600)
            with os.fdopen(fd, "ab") as file:
                file.write(line)
            return True
        except Exception as exc:
            self.log_error("lead queue failed: %s: %s", type(exc).__name__, exc)
            return False

    def _try_send_lead_email(self, lead):
        try:
            self._send_lead_email(lead)
            return True
        except Exception as exc:
            self.log_error("lead email failed: %s: %s", type(exc).__name__, exc)
            return False

    def _send_lead_email(self, lead):
        msg = EmailMessage()
        msg["From"] = LEAD_SENDER
        msg["To"] = LEAD_RECIPIENT
        msg["Subject"] = "Новая заявка с лендинга Робот ПСА"
        msg["Date"] = formatdate(localtime=True)
        msg["X-RobotPSA-Source"] = "robotpsa.ru"
        msg.set_content(self._format_lead_email(lead))

        last_error = None
        for host in SMTP_HOSTS:
            try:
                with smtplib.SMTP(host, 25, timeout=SMTP_TIMEOUT) as smtp:
                    smtp.ehlo("robotpsa.ru")
                    if smtp.has_extn("starttls"):
                        smtp.starttls(context=ssl.create_default_context())
                        smtp.ehlo("robotpsa.ru")
                    smtp.send_message(msg)
                    return
            except Exception as exc:
                self.log_error("smtp host %s failed: %s: %s", host, type(exc).__name__, exc)
                last_error = exc
        raise RuntimeError("SMTP delivery failed") from last_error

    def _format_lead_email(self, lead):
        fields = [
            ("Компания", lead.get("company")),
            ("Ваше имя", lead.get("name")),
            ("Телефон или Telegram", lead.get("contact")),
            ("Примерный объем", lead.get("volume")),
            ("Калькулятор", lead.get("calculator")),
            ("Страница", lead.get("page")),
            ("Referrer", lead.get("referrer")),
            ("Источник", lead.get("source") or lead.get("site")),
            ("IP", self.client_address[0] if self.client_address else ""),
            ("User-Agent", self.headers.get("User-Agent", "")),
        ]
        lines = ["Новая заявка с лендинга Робот ПСА", ""]
        for label, value in fields:
            if value:
                lines.append(f"{label}: {value}")
        return "\n".join(lines) + "\n"

    def _send_lead_success(self, accepts_json, queued=False, mail_sent=False):
        if accepts_json:
            self._send_json({"success": True, "queued": queued, "mailSent": mail_sent}, HTTPStatus.OK)
            return
        self.send_response(HTTPStatus.SEE_OTHER)
        self.send_header("Location", "/?sent=1#demo")
        self.end_headers()

    def _send_lead_error(self, message, status, accepts_json):
        if accepts_json:
            self._send_json({"success": False, "message": message}, status)
            return
        self.send_error(status, message)

    def _send_json(self, payload, status):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--bind", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=18080)
    parser.add_argument("--directory", required=True)
    args = parser.parse_args()

    directory = os.path.abspath(args.directory)
    mimetypes.add_type("text/css", ".css")
    mimetypes.add_type("application/javascript", ".js")
    handler = functools.partial(StaticHandler, directory=directory)
    server = ThreadingHTTPServer((args.bind, args.port), handler)
    server.serve_forever()


if __name__ == "__main__":
    main()
