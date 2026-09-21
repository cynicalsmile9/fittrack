#!/bin/bash
# Запуск FitTrack для доступа с телефона:  bash start.sh
cd "$(dirname "$0")"
pkill -f "fittrack_server.py" 2>/dev/null; pkill -f "serve.py" 2>/dev/null; sleep 0.5
nohup python3 serve.py >/dev/null 2>&1 &
sleep 1
IP=$(ipconfig getifaddr en0 || ipconfig getifaddr en1 || ipconfig getifaddr en2)
echo ""
echo "  FitTrack запущен."
echo "  На компьютере:   http://localhost:8787"
echo "  На телефоне:     http://${IP:-<IP-Mac>}:8787"
echo ""
echo "  Телефон должен быть в той же Wi-Fi сети, что и этот Mac."
echo "  Скрипт работает, пока не закрыть терминал (Ctrl+C — остановить)."
