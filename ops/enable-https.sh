#!/bin/sh
set -eu

pem_file="/etc/haproxy/certs/robotpsa.ru.pem"
cfg="/etc/haproxy/haproxy.cfg"

if [ ! -r "$pem_file" ]; then
  echo "Missing $pem_file. Run /opt/robotpsa/issue-letsencrypt.sh first." >&2
  exit 1
fi

tmp_cfg="$(mktemp /tmp/haproxy.robotpsa-https.XXXXXX.cfg)"
trap 'rm -f "$tmp_cfg"' EXIT

python3 - "$cfg" > "$tmp_cfg" <<'PY'
import sys
from pathlib import Path

cfg_path = Path(sys.argv[1])
text = cfg_path.read_text()

def replace_once(haystack, old, new, label):
    if old not in haystack:
        raise SystemExit(f"Cannot find HAProxy insertion point: {label}")
    return haystack.replace(old, new, 1)

if "acl robotpsa_www req.ssl_sni -i robotpsa.ru www.robotpsa.ru" not in text:
    old = "    acl mail_www req.ssl_sni -i mail.itpr.ru\n"
    new = old + "    acl robotpsa_www req.ssl_sni -i robotpsa.ru www.robotpsa.ru\n"
    text = replace_once(text, old, new, "robotpsa SNI ACL")

if "use_backend https_robotpsa if robotpsa_www" not in text:
    old = "\tuse_backend https_mail if mail_www\n"
    new = "\tuse_backend https_robotpsa if robotpsa_www\n" + old
    text = replace_once(text, old, new, "robotpsa SNI backend route")

if "\nbackend https_robotpsa\n" not in text:
    old = (
        "backend https_mail\n"
        "    mode tcp\n"
        "    option ssl-hello-chk\n"
        "    server www 192.168.115.231:443\n"
    )
    new = old + (
        "\n"
        "backend https_robotpsa\n"
        "    mode tcp\n"
        "    default-server inter 3s rise 2 fall 3\n"
        "    server robotpsa_tls 127.0.0.1:18443 check\n"
    )
    text = replace_once(text, old, new, "robotpsa TCP backend")

if "frontend robotpsa_https_terminator" not in text:
    terminator = (
        "\n"
        "frontend robotpsa_https_terminator\n"
        "    bind 127.0.0.1:18443 ssl crt /etc/haproxy/certs/robotpsa.ru.pem alpn h2,http/1.1\n"
        "    mode http\n"
        "    option httplog\n"
        "    http-request set-header X-Forwarded-Proto https\n"
        "    http-request set-header X-Forwarded-Host %[req.hdr(Host)]\n"
        "    http-response set-header Strict-Transport-Security \"max-age=31536000; includeSubDomains\"\n"
        "    default_backend robotpsa_web80\n"
        "\n"
    )
    text = replace_once(text, "\nfrontend http_front80\n", terminator + "frontend http_front80\n", "robotpsa TLS terminator")

redirect_acl = "\tacl robotpsa_host_redirect hdr(host) -i robotpsa.ru www.robotpsa.ru robotpsa.ru:80 www.robotpsa.ru:80\n"
if "acl robotpsa_host_redirect hdr(host)" not in text:
    text = replace_once(
        text,
        "\toption httpclose\n",
        "\toption httpclose\n"
        + redirect_acl
        + "\tacl robotpsa_acme_redirect path_beg /.well-known/acme-challenge/\n"
        + "\thttp-request redirect scheme https code 301 if robotpsa_host_redirect !robotpsa_acme_redirect\n",
        "robotpsa HTTP redirect",
    )

sys.stdout.write(text)
PY

haproxy -c -f "$tmp_cfg"
backup="/etc/haproxy/haproxy.cfg.codex-robotpsa-https-$(date +%Y%m%d-%H%M%S).bak"
cp -a "$cfg" "$backup"
install -o root -g root -m 0644 "$tmp_cfg" "$cfg"
haproxy -c -f "$cfg"
systemctl reload haproxy
echo "Enabled HTTPS for robotpsa.ru. Backup: $backup"
