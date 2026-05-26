#!/data/data/com.termux/files/usr/bin/sh

cd ~/sentinela
pm2 resurrect || pm2 start sentinela.js --name sentinela
