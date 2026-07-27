#!/bin/bash
# Publica a landing e carimba a versão, para o cliente ver a página nova no primeiro toque.
set -e
cd "$(dirname "$0")"
V=$(date +%Y%m%d-%H%M)
printf '{"versao":"%s"}' "$V" > versao.json
perl -pi -e "s/const MINHA_VERSAO = '[^']*'/const MINHA_VERSAO = '$V'/" index.html
git add -A
git commit -q -m "${1:-Atualização da landing} (versão $V)" || { echo "nada para publicar"; exit 0; }
git push -q origin main
echo "publicado · versão $V"
