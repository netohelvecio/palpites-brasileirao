# DuckDNS setup

DNS dinâmico gratuito apontando pra IP público da VM Oracle. Em conjunto com o Caddy do `docker-compose.prod.yml`, dá HTTPS automático via Let's Encrypt.

## 1. Criar conta e subdomínio

1. Acessar https://www.duckdns.org/ → login com Google/GitHub
2. Em "domains", criar `palpites-bolao` (ou outro nome desejado)
3. Apontar pro IP público da VM no campo "current ip"
4. Copiar o **token** exibido no topo da página (formato UUID)

## 2. Cron na VM (atualização periódica do IP)

Oracle Free Tier dá IP público reservado, mas atualização periódica é seguro de barganha (caso a VM seja recriada).

```bash
TOKEN="<seu-token-duckdns>"
SUBDOMAIN="palpites-bolao"

echo "*/5 * * * * deploy curl -s 'https://www.duckdns.org/update?domains=${SUBDOMAIN}&token=${TOKEN}&ip=' >> /var/log/duckdns.log 2>&1" |
  sudo tee /etc/cron.d/duckdns
sudo chmod 644 /etc/cron.d/duckdns

sudo touch /var/log/duckdns.log
sudo chown deploy:deploy /var/log/duckdns.log
```

`ip=` vazio faz o DuckDNS detectar o IP de origem da requisição. Cron roda a cada 5 min.

## 3. Validação

```bash
# Update manual:
curl "https://www.duckdns.org/update?domains=${SUBDOMAIN}&token=${TOKEN}&ip="
# expected output: OK

# Resolução DNS:
dig +short palpites-bolao.duckdns.org
# expected: IP da VM
```

## 4. Validação ponta-a-ponta com Caddy

Após `docker compose -f docker-compose.prod.yml up -d` rodar com a stack pronta:

```bash
curl -i https://palpites-bolao.duckdns.org/health
```

Expected: `HTTP/2 200` com body `{"status":"ok","db":"up"}`.

A primeira requisição HTTPS pode demorar 10–30s — Caddy emite o cert Let's Encrypt na hora. Subsequentes são instantâneas (cert fica em volume `caddy_data`).
