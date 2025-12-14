import { Telegraf } from 'telegraf';
import mongoose from 'mongoose';
import 'dotenv/config';
import http from 'http'; // Додали модуль для сервера

// === 1. ПІДКЛЮЧЕННЯ ДО БАЗИ ===
if (!process.env.DB_URL) {
    console.error('❌ Помилка: Немає посилання на базу (DB_URL)');
    process.exit(1);
}

mongoose.connect(process.env.DB_URL)
    .then(() => console.log('✅ База даних підключена!'))
    .catch((err) => console.error('❌ Помилка БД:', err));

const ExpenseSchema = new mongoose.Schema({
    userId: Number,
    amount: Number,
    category: String,
    date: { type: Date, default: Date.now }
});
const Expense = mongoose.model('Expense', ExpenseSchema);

// === 2. БОТ ===
const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start((ctx) => ctx.reply('Привіт! 👋 Я онлайн 24/7.'));
bot.command('list', async (ctx) => {
    /* Тут скорочено для економії місця, логіка та сама */
    const expenses = await Expense.find({ userId: ctx.from.id }).sort({ date: 1 });
    if (!expenses.length) return ctx.reply('Пусто.');
    let msg = '📋 **Твої витрати:**\n';
    expenses.forEach((e, i) => msg += `${i+1}. ${e.amount} грн — ${e.category}\n`);
    ctx.reply(msg);
});
bot.command('clear', async (ctx) => {
    await Expense.deleteMany({ userId: ctx.from.id });
    ctx.reply('🗑 Все видалено.');
});
bot.on('text', async (ctx) => {
    const parts = ctx.message.text.split(' ');
    const amount = parseFloat(parts[0]);
    const category = parts.slice(1).join(' ');
    if (!isNaN(amount) && category) {
        await new Expense({ userId: ctx.from.id, amount, category }).save();
        ctx.reply(`✅ +${amount} грн на ${category}`);
    } else {
        ctx.reply('Формат: 100 кава');
    }
});

bot.launch();

// === 3. ТРЮК ДЛЯ СЕРВЕРА (RENDER) ===
// Ми створюємо пустий веб-сервер, щоб Render бачив, що ми живі
const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Bot is running!');
});
// Слухаємо порт, який видасть сервер, або 3000
const port = process.env.PORT || 3000;
server.listen(port, () => console.log(`🌍 Server running on port ${port}`));

// Зупинка
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));