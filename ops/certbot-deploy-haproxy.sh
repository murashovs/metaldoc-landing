#!/bin/sh
set -eu

domain="robotpsa.ru"
live_dir="/etc/letsencrypt/live/$domain"
pem_dir="/etc/haproxy/certs"
pem_file="$pem_dir/$domain.pem"

if [ ! -r "$live_dir/fullchain.pem" ] || [ ! -r "$live_dir/privkey.pem" ]; then
  echo "Certificate files for $domain are not present yet; skipping HAProxy PEM build."
  exit 0
fi

install -d -o root -g haproxy -m 0750 "$pem_dir"
tmp_file="$(mktemp "$pem_file.tmp.XXXXXX")"
cat "$live_dir/fullchain.pem" "$live_dir/privkey.pem" > "$tmp_file"
chown root:haproxy "$tmp_file"
chmod 0640 "$tmp_file"
mv -f "$tmp_file" "$pem_file"

haproxy -c -f /etc/haproxy/haproxy.cfg
systemctl reload haproxy
echo "Installed $pem_file and reloaded HAProxy."
