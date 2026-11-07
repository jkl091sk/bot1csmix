# Bot1cs Status Bot — JavaScript / Node.js

Переписанная на JavaScript версия Telegram-бота для проверки CS 1.6 серверов.

## Команды

| Команда | Действие |
|---|---|
| `/start` | Приветствие и список команд |
| `/help` | Справка |
| `/mix` | Проверка `91.211.118.97:27027` |
| `/mix2` | Проверка `57.128.210.53:27062` |

Бот показывает название сервера, карту, текущий онлайн, список игроков и их очки. Запросы к серверам выполняются через A2S (GameDig). Если сервер недоступен, бот сообщает об этом. В группах команды поддерживают стандартный формат Telegram, например `/mix@Bot1cs_Status_Bot`.

## Установка и запуск

Требуется Node.js 18 или новее.

1. Установи Node.js.
2. Распакуй архив в отдельную папку.
3. В этой папке установи зависимости:

   ```bash
   npm install
   ```

4. Скопируй `.env.example` в `.env`.
5. В `.env` укажи действующий токен бота в `BOT_TOKEN`.
6. Запусти:

   ```bash
   npm start
   ```

Не публикуй `.env` и не отправляй токен посторонним.

## Настройка серверов

IP, порты и таймаут можно изменить в `.env`:

```env
SERVER_IP=91.211.118.97
SERVER_PORT=27027
SERVER2_IP=57.128.210.53
SERVER2_PORT=27062
A2S_TIMEOUT=5000
```

## Хостинг / VPS

- Файл запуска: `bot.js`
- Команда запуска: `npm start`
- Установка зависимостей: `npm install`
- Версия Node.js: 18+

Боту нужен исходящий HTTPS-доступ к Telegram и исходящий UDP-доступ к игровым серверам. Входящие порты открывать не нужно. Одновременно должна работать только одна копия бота, иначе Telegram может вернуть ошибку `Conflict`.

## Автозапуск через systemd

Пример `/etc/systemd/system/csbot.service` (замени путь на фактический):

```ini
[Unit]
Description=CS 1.6 Status Telegram Bot
After=network-online.target
Wants=network-online.target

[Service]
WorkingDirectory=/opt/Bot1cs_Status_Bot
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Затем:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now csbot
sudo journalctl -u csbot -f
```

## Примечание о данных игроков

GameDig получает данные через игровой A2S-протокол. Набор полей игрока (в частности, время на сервере) зависит от сервера и реализации протокола; если сервер не передаёт время, бот покажет `0с`.
