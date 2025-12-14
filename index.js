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

// Оновив текст привітання, додав сюди опис нових команд
bot.start((ctx) => ctx.reply('Привіт! 👋 Я онлайн 24/7.\n\nТвій фінансовий помічник готовий.\n\n📌 **Як користуватись:**\nПиши: `100 кава` (сума пробіл категорія)\n\n📊 /stats - аналітика витрат (НОВЕ!)\n📋 /list - список усіх витрат\n🗑 /delete 1 - видалити запис номер 1\n🧨 /clear - видалити все'));

// === НОВА КОМАНДА: СТАТИСТИКА ===
bot.command('stats', async (ctx) => {
    try {
        const expenses = await Expense.find({ userId: ctx.from.id });

        if (expenses.length === 0) return ctx.reply('📭 Немає даних для статистики. Додай витрати!');

        // 1. Рахуємо загальну суму і групуємо по категоріях
        let totalSum = 0;
        const categoryStats = {};

        expenses.forEach(item => {
            totalSum += item.amount;
            
            // Якщо такої категорії ще немає - створюємо
            if (!categoryStats[item.category]) {
                categoryStats[item.category] = 0;
            }
            // Плюсуємо суму
            categoryStats[item.category] += item.amount;
        });

        // 2. Сортуємо: від найдорожчих до найдешевших
        const sortedCategories = Object.entries(categoryStats)
            .sort((a, b) => b[1] - a[1]); 

        // 3. Формуємо красиве повідомлення
        let message = `📊 **Аналітика витрат:**\n\n`;
        message += `💰 **Всього:** ${totalSum} грн\n\n`;

        sortedCategories.forEach(([cat, sum]) => {
            const percent = ((sum / totalSum) * 100).toFixed(1); // Рахуємо відсоток
            // Малюємо "графік" квадратиками
            const bar = '🟦'.repeat(Math.round(percent / 10)); 
            
            message += `${bar} ${percent}%\n**${cat.toUpperCase()}**: ${sum} грн\n\n`;
        });

        ctx.reply(message);

    } catch (e) {
        console.error(e);
        ctx.reply('❌ Помилка при розрахунку статистики.');
    }
});

// === СТАРІ КОМАНДИ (БЕЗ ЗМІН) ===

// Команда LIST
bot.command('list', async (ctx) => {
    try {
        const expenses = await Expense.find({ userId: ctx.from.id }).sort({ date: 1 });
        if (expenses.length === 0) return ctx.reply('📭 Список порожній.');
        
        let message = '📋 **Твої витрати:**\n\n';
        let total = 0;
        expenses.forEach((item, index) => {
            // Додав форматування дати (день.місяць)
            const dateStr = item.date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'numeric' });
            message += `${index + 1}. [${dateStr}] ${item.amount} грн — ${item.category}\n`;
            total += item.amount;
        });
        message += `\n💰 **Всього:** ${total} грн`;
        ctx.reply(message);
    } catch (e) { ctx.reply('Помилка списку'); }
});

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

// Команда CLEAR
bot.command('clear', async (ctx) => {
    await Expense.deleteMany({ userId: ctx.from.id });
    ctx.reply('🗑 Все видалено.');
});

// Обробка ТЕКСТУ (додавання витрати)
bot.on('text', async (ctx) => {
    const parts = ctx.message.text.split(' ');
    const amount = parseFloat(parts[0]);
    
    // ТУТ ЗМІНА: .toLowerCase() щоб "Кава" і "кава" були однакові
    const category = parts.slice(1).join(' ').toLowerCase(); 

    if (!isNaN(amount) && category) {
        try {
            await new Expense({ userId: ctx.from.id, amount, category }).save();
            ctx.reply(`✅ Записано: ${amount} грн на "${category}"`);
        } catch (e) { ctx.reply('Помилка запису'); }
    } else {
        ctx.reply('❌ Формат: 100 кава\nКоманди: /stats, /list, /delete номер');
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