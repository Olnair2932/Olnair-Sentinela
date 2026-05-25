#!/data/data/com.termux/files/usr/bin/sh

cd ~/sentinela

while true; do
  echo "🚀 Iniciando Sentinela..."
  node sentinela.js

  echo "⚠️ Sentinela caiu! Reiniciando em 3s..."
  sleep 3
done
