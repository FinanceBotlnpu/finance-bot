import { Telegraf } from 'telegraf';
import mongoose from 'mongoose';
import 'dotenv/config';
import http from 'http'; // Для сервера Render

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

// Команда LIST
bot.command('list', async (ctx) => {
    try {
        const expenses = await Expense.find({ userId: ctx.from.id }).sort({ date: 1 });
        if (expenses.length === 0) return ctx.reply('📭 Список порожній.');
        
        let message = '📋 **Твої витрати:**\n\n';
        let total = 0;
        expenses.forEach((item, index) => {
            message += `${index + 1}. ${item.amount} грн — ${item.category}\n`;
            total += item.amount;
        });
        message += `\n💰 **Всього:** ${total} грн`;
        ctx.reply(message);
    } catch (e) { ctx.reply('Помилка списку'); }
});

// === ОСЬ ЦЮ ЧАСТИНУ Я ПРОПУСТИВ МИНУЛОГО РАЗУ ===
// Команда DELETE
bot.command('delete', async (ctx) => {
    const args = ctx.message.text.split(' '); // /delete 1
    const index = parseInt(args[1]) - 1;

    if (isNaN(index)) return ctx.reply('⚠️ Вкажи номер. Приклад: /delete 1');

    try {
        const expenses = await Expense.find({ userId: ctx.from.id }).sort({ date: 1 });
        if (index < 0 || index >= expenses.length) return ctx.reply('⚠️ Такого номеру немає.');

        const item = expenses[index];
        await Expense.findByIdAndDelete(item._id);
        ctx.reply(`✅ Видалено: ${item.amount} грн — ${item.category}`);
    } catch (e) { ctx.reply('Помилка видалення'); }
});
// ==================================================

// Команда CLEAR
bot.command('clear', async (ctx) => {
    await Expense.deleteMany({ userId: ctx.from.id });
    ctx.reply('🗑 Все видалено.');
});

// Обробка ТЕКСТУ
bot.on('text', async (ctx) => {
    const parts = ctx.message.text.split(' ');
    const amount = parseFloat(parts[0]);
    const category = parts.slice(1).join(' ');

    if (!isNaN(amount) && category) {
        try {
            await new Expense({ userId: ctx.from.id, amount, category }).save();
            ctx.reply(`✅ Записано: ${amount} грн на "${category}"`);
        } catch (e) { ctx.reply('Помилка запису'); }
    } else {
        ctx.reply('❌ Формат: 100 кава\nКоманди: /list, /delete номер');
    }
});

bot.launch();

// === 3. СЕРВЕРНИЙ КОД (ЩОБ RENDER НЕ ВИМИКАВСЯ) ===
const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Bot is running!');
});
server.listen(process.env.PORT || 3000);

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));