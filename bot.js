'use strict';

require('dotenv').config();
const { Telegraf } = require('telegraf');
const { GameDig } = require('gamedig');

// ============================================================
// CONFIGURATION
// ============================================================
const BOT_TOKEN = process.env.BOT_TOKEN;
const A2S_TIMEOUT = Number(process.env.A2S_TIMEOUT || 5000);

const SERVERS = {
  mix: { ip: process.env.SERVER_IP || '91.211.118.97', port: Number(process.env.SERVER_PORT || 27027) },
  mix2: { ip: process.env.SERVER2_IP || '57.128.210.53', port: Number(process.env.SERVER2_PORT || 27062) },
};

// ============================================================
// LOGGING / HELPERS
// ============================================================
function log(level, ...args) {
  console[level](`[${new Date().toISOString()}]`, ...args);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatTime(value) {
  let seconds = Number.parseInt(value, 10);
  if (!Number.isFinite(seconds)) seconds = 0;
  seconds = Math.max(0, seconds);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}ч ${minutes}м`;
  if (minutes > 0) return `${minutes}м`;
  return `${seconds}с`;
}

// ============================================================
// QUERY CS 1.6 SERVER (A2S)
// ============================================================
async function getServerData(ip, port) {
  try {
    // GameDig performs the Source A2S_INFO/A2S_PLAYER queries.
    const state = await GameDig.query({
      type: 'cs16',
      host: ip,
      port,
      socketTimeout: A2S_TIMEOUT,
      attemptTimeout: A2S_TIMEOUT,
      maxAttempts: 1,
    });

    return {
      info: {
        serverName: state.name || 'CS 1.6 Server',
        mapName: state.map || 'Неизвестно',
        playerCount: Number(state.numplayers ?? state.players?.length ?? 0),
        maxPlayers: Number(state.maxplayers ?? 0),
      },
      players: Array.isArray(state.players) ? state.players : [],
    };
  } catch (error) {
    log('warn', `Не удалось получить данные ${ip}:${port}:`, error.message || error);
    return null;
  }
}

// ============================================================
// TELEGRAM MESSAGE FORMAT
// ============================================================
function createMessage(data, ip, port) {
  const { info, players } = data;
  const serverName = escapeHtml(info.serverName);
  const mapName = escapeHtml(info.mapName);

  const sortedPlayers = [...players].sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
  const playerLines = sortedPlayers.length
    ? sortedPlayers.map((player, index) => {
        const name = escapeHtml(player.name || 'Unknown') || 'Unknown';
        const score = Number(player.score || 0);
        // GameDig exposes player time in seconds on supported query types.
        const duration = player.time ?? player.duration ?? 0;
        return `${index + 1}. <b>${name}</b> — ${score} очк. (${formatTime(duration)})`;
      })
    : ['На сервере нет игроков.'];

  return [
    '🎮 <b>CS 1.6 SERVER STATUS</b>',
    '',
    '🖥 <b>Сервер:</b>',
    serverName,
    '',
    `🌐 <b>IP:</b> <code>${escapeHtml(ip)}:${port}</code>`,
    `🗺 <b>Карта:</b> ${mapName}`,
    `👥 <b>Игроки:</b> ${info.playerCount}/${info.maxPlayers}`,
    '',
    '━━━━━━━━━━━━━━━━━━',
    '',
    '🎯 <b>Игра:</b> CS 1.6',
    '',
    '👤 <b>Игроки онлайн:</b>',
    ...playerLines,
    '',
    '━━━━━━━━━━━━━━━━━━',
    '',
    '🟢 <b>Сервер доступен</b>',
  ].join('\n');
}

// ============================================================
// COMMANDS
// ============================================================
async function startCommand(ctx) {
  const message = [
    '👋 <b>Привет!</b>',
    '',
    'Я бот для проверки CS 1.6 сервера.',
    '',
    '🎮 <b>Доступные команды:</b>',
    '',
    '/mix — проверить сервер',
    '/mix2 — проверить второй сервер',
    '/help — помощь',
    '',
    `🌐 Сервер /mix:\n<code>${SERVERS.mix.ip}:${SERVERS.mix.port}</code>`,
    '',
    `🌐 Сервер /mix2:\n<code>${SERVERS.mix2.ip}:${SERVERS.mix2.port}</code>`,
  ].join('\n');
  await ctx.reply(message, { parse_mode: 'HTML' });
}

async function helpCommand(ctx) {
  const message = [
    'ℹ️ <b>Помощь</b>',
    '',
    'Используй команду:',
    '',
    '🎮 <code>/mix</code> — первый сервер',
    '🎮 <code>/mix2</code> — второй сервер',
    '',
    'Бот проверит CS 1.6 сервер и покажет:',
    '',
    '🟢 доступность сервера',
    '🗺 текущую карту',
    '👥 количество игроков',
    '👤 список игроков',
    '🎯 очки игроков',
    '⏱ время игроков на сервере',
    '',
    `🌐 <b>/mix:</b>\n<code>${SERVERS.mix.ip}:${SERVERS.mix.port}</code>`,
    '',
    `🌐 <b>/mix2:</b>\n<code>${SERVERS.mix2.ip}:${SERVERS.mix2.port}</code>`,
  ].join('\n');
  await ctx.reply(message, { parse_mode: 'HTML' });
}

async function checkServer(ctx, { ip, port }) {
  const waiting = await ctx.reply('🔄 <b>Проверяю CS 1.6 сервер...</b>', { parse_mode: 'HTML' });
  const data = await getServerData(ip, port);

  if (!data) {
    const message = [
      '⚠️ <b>Сервер в данный момент недоступен.</b>',
      '',
      `🌐 <code>${ip}:${port}</code>`,
      '',
      'Попробуйте проверить немного позже.',
    ].join('\n');
    try {
      await ctx.telegram.editMessageText(ctx.chat.id, waiting.message_id, undefined, message, { parse_mode: 'HTML' });
    } catch (error) {
      log('warn', 'Не удалось обновить сообщение ожидания:', error.message || error);
    }
    return;
  }

  const message = createMessage(data, ip, port);
  try {
    await ctx.telegram.editMessageText(ctx.chat.id, waiting.message_id, undefined, message, { parse_mode: 'HTML' });
  } catch (error) {
    log('warn', 'Не удалось изменить сообщение, отправляю новое:', error.message || error);
    await ctx.reply(message, { parse_mode: 'HTML' });
  }
}

// ============================================================
// STARTUP
// ============================================================
if (!BOT_TOKEN) {
  console.error('\nОШИБКА: не указан BOT_TOKEN. Создай файл .env по примеру .env.example\n');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
bot.start(startCommand);
bot.help(helpCommand);
bot.command('mix', (ctx) => checkServer(ctx, SERVERS.mix));
bot.command('mix2', (ctx) => checkServer(ctx, SERVERS.mix2));
bot.catch((error, ctx) => {
  log('error', `Ошибка Telegram при обработке ${ctx.updateType}:`, error);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

log('log', '==========================================');
log('log', '       CS 1.6 STATUS TELEGRAM BOT (Node.js)');
log('log', '==========================================');
log('log', `CS 1.6 сервер (/mix): ${SERVERS.mix.ip}:${SERVERS.mix.port}`);
log('log', `CS 1.6 сервер (/mix2): ${SERVERS.mix2.ip}:${SERVERS.mix2.port}`);
log('log', 'Бот запускается...');

bot.launch({ dropPendingUpdates: true })
  .then(() => log('log', 'Бот успешно запущен! Не закрывайте этот процесс.'))
  .catch((error) => {
    log('error', 'Ошибка при запуске бота:', error);
    process.exit(1);
  });
