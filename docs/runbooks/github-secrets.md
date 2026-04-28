# GitHub Secrets — palpites-brasileirao

Configurar em **Settings → Secrets and variables → Actions** do repo.

## Repository secrets

| Nome              | Origem                                   | Notas                                                                                                                                                                  |
| ----------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DEPLOY_HOST`     | IP público da VM Oracle                  | Ex: `192.0.2.42`                                                                                                                                                       |
| `DEPLOY_USER`     | `deploy`                                 | Usuário não-root criado no provisioning (Plan 6.5)                                                                                                                     |
| `DEPLOY_SSH_KEY` | chave privada SSH do `deploy@VM`         | OpenSSH format completo (incluindo `-----BEGIN…` e `-----END…`). Sem passphrase — Actions não suporta. Gerar com `ssh-keygen -t ed25519 -f ~/.ssh/palpites_deploy -N ""`. |

`GITHUB_TOKEN` é automático — não configurar manualmente.

## Environment "production"

Criar em **Settings → Environments → New environment** com o nome `production`.

- **Sem secrets adicionais** — o workflow `deploy.yml` referencia `environment: production` e usa os repository secrets acima.
- Opcional: marcar **Required reviewers** com você mesmo, se quiser confirmar manual antes de cada deploy disparar.

## Como gerar `DEPLOY_SSH_KEY`

Localmente (na sua máquina dev, **não** na VM):

```bash
ssh-keygen -t ed25519 -f ~/.ssh/palpites_deploy -C "github-actions-deploy" -N ""
```

Resultado:

- `~/.ssh/palpites_deploy` — **chave privada** → cole conteúdo completo no secret `DEPLOY_SSH_KEY`
- `~/.ssh/palpites_deploy.pub` — chave pública → adicione a `/home/deploy/.ssh/authorized_keys` na VM

```bash
cat ~/.ssh/palpites_deploy.pub | ssh deploy@<IP> "cat >> ~/.ssh/authorized_keys"
```

Testar:

```bash
ssh -i ~/.ssh/palpites_deploy deploy@<IP> "echo ok"
```

Expected: `ok`.

## GHCR (registry de imagens Docker)

O workflow `deploy.yml` usa `${{ secrets.GITHUB_TOKEN }}` (automático) com permissão `packages: write` pra empurrar imagens pra `ghcr.io/<owner>/palpites-api`.

Após o primeiro push, o pacote `palpites-api` aparece em **Profile → Packages** como **privado**. Pra puxar na VM, faça `docker login ghcr.io` lá com um Personal Access Token (PAT) com escopo `read:packages`. Documentado em `docs/superpowers/plans/2026-04-27-plan-6.5-provisioning-runbook.md`.

Pra tornar público (não recomendado pra projeto pessoal): Package settings → "Change visibility" → Public.
