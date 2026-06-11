#!/bin/sh
set -eu

domain="robotpsa.ru"
www_domain="www.robotpsa.ru"
server_ip="45.10.245.231"
webroot="/srv/robotpsa/current"
email="${LETSENCRYPT_EMAIL:-admin@robotpsa.ru}"

check_dns() {
  name="$1"
  ips="$(getent ahostsv4 "$name" | awk '{print $1}' | sort -u || true)"
  if ! printf '%s\n' "$ips" | grep -qx "$server_ip"; then
    echo "DNS is not ready for $name. Expected A $server_ip, got: ${ips:-<empty>}" >&2
    return 1
  fi
}

check_dns "$domain"
check_dns "$www_domain"

challenge_dir="$webroot/.well-known/acme-challenge"
install -d -o root -g root -m 0755 "$challenge_dir"
token="robotpsa-acme-check-$$"
printf 'ok\n' > "$challenge_dir/$token"
trap 'rm -f "$challenge_dir/$token"' EXIT

if [ "$(curl -fsS --max-time 10 "http://$domain/.well-known/acme-challenge/$token")" != "ok" ]; then
  echo "HTTP-01 webroot check failed for $domain." >&2
  exit 1
fi

certbot certonly \
  --webroot \
  -w "$webroot" \
  -d "$domain" \
  -d "$www_domain" \
  --email "$email" \
  --agree-tos \
  --no-eff-email \
  --keep-until-expiring

/etc/letsencrypt/renewal-hooks/deploy/haproxy-robotpsa.sh
