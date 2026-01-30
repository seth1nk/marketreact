import asyncio
import logging
import aiohttp
import html
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import CommandStart, CommandObject, Command
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, CallbackQuery
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup

# ==========================================
# КОНФИГУРАЦИЯ
# ==========================================

BOT_TOKEN = "8327873454:AAEbB6_rS3hiVc2wCWsiL_LUXZMRC-sPJnY"
ADMIN_ID = 1163547353

SBP_PHONE = "+7 950 050-98-68"
SBP_BANK = "ВТБ банк"
RECIPIENT_NAME = "Константин В."

# Адреса сервера
API_URL = "https://market.apt142.ru/api/internal/orders"

# ==========================================

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()
logging.basicConfig(level=logging.INFO)

class BotStates(StatesGroup):
    waiting_for_screenshot = State()
    in_support_chat = State()
    admin_replying = State()

# --- КЛАВИАТУРЫ ---

def get_return_keyboard():
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📂 Список заказов", callback_data="my_orders")]
    ])

def get_support_exit_keyboard():
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🔙 Выйти из чата", callback_data="exit_support")]
    ])

def get_payment_decision_keyboard(order_id, user_id, type_):
    lbl = "ПОЛНУЮ" if type_ == "full" else "1/3"
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=f"✅ Подтвердить {lbl}", callback_data=f"conf_{type_}_{order_id}_{user_id}")],
        [InlineKeyboardButton(text="❌ Отклонить", callback_data=f"conf_reject_{order_id}_{user_id}")]
    ])

def get_admin_approval_keyboard(order_id, user_id):
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="✅ Согласовать", callback_data=f"adm_yes_{order_id}_{user_id}")],
        [InlineKeyboardButton(text="❌ Отказать", callback_data=f"adm_no_{order_id}_{user_id}")]
    ])

# Кнопка для АДМИНА (чтобы ответить юзеру)
def get_admin_reply_keyboard(user_id):
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="↩️ Ответить пользователю", callback_data=f"reply_to_{user_id}")]
    ])

# !!! КНОПКА ДЛЯ ПОЛЬЗОВАТЕЛЯ (которую ты просил) !!!
def get_user_reply_keyboard():
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="✍️ Ответить", callback_data="user_reply_support")]
    ])

# --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---

async def link_user_to_order(order_id, telegram_id):
    try:
        async with aiohttp.ClientSession(connector=aiohttp.TCPConnector(ssl=False)) as session:
            payload = {"orderId": str(order_id), "telegramId": str(telegram_id)}
            async with session.post(f"{API_URL}/link-telegram", json=payload) as resp:
                if resp.status == 200:
                    return True, "OK"
                else:
                    return False, f"Ошибка: {resp.status}"
    except Exception as e:
        return False, f"Сеть: {e}"

async def notify_backend(order_id, type_):
    try:
        async with aiohttp.ClientSession(connector=aiohttp.TCPConnector(ssl=False)) as session:
            async with session.post(f"{API_URL}/{order_id}/confirm", json={"payment_type": type_}) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return data.get('order_number')
                return None
    except: return None

# ==========================================
# ЛОГИКА
# ==========================================

@dp.message(CommandStart())
async def cmd_start(message: types.Message, command: CommandObject, state: FSMContext):
    await state.clear()
    args = command.args
    
    if not args:
        await show_my_orders_logic(message, message.from_user.id)
        return

    order_id = args
    await link_user_to_order(order_id, message.from_user.id)

    try:
        async with aiohttp.ClientSession(connector=aiohttp.TCPConnector(ssl=False)) as session:
            async with session.get(f"{API_URL}/{order_id}") as resp:
                if resp.status != 200:
                    await message.answer("❌ Заказ не найден.")
                    return
                order = await resp.json()

        await show_single_order(message, order)
    except Exception as e:
        logging.error(f"Error start: {e}")
        await message.answer("Ошибка сервера.")

# --- СПИСОК ЗАКАЗОВ ---

@dp.message(Command("orders"))
@dp.callback_query(F.data == "my_orders")
async def show_orders_cmd(event: types.Message | CallbackQuery, state: FSMContext = None):
    if state: await state.clear()
    msg = event.message if isinstance(event, CallbackQuery) else event
    user_id = event.from_user.id
    
    await show_my_orders_logic(msg, user_id, isinstance(event, CallbackQuery))

async def show_my_orders_logic(message, user_id, is_edit=False):
    try:
        async with aiohttp.ClientSession(connector=aiohttp.TCPConnector(ssl=False)) as session:
            async with session.get(f"{API_URL}/by-telegram/{user_id}") as resp:
                if resp.status != 200:
                    text = "📭 У вас нет заказов."
                    if is_edit: await message.edit_text(text)
                    else: await message.answer(text)
                    return
                orders = await resp.json()

        if not orders:
            text = "📭 Список заказов пуст."
            if is_edit: await message.edit_text(text)
            else: await message.answer(text)
            return

        keyboard = []
        for o in orders:
            btn_text = f"#{o.get('order_number')} | {o.get('subject')[:15]}..."
            keyboard.append([InlineKeyboardButton(text=btn_text, callback_data=f"view_order_{o.get('id')}")])
        
        keyboard.append([InlineKeyboardButton(text="🔄 Обновить", callback_data="my_orders")])
        
        markup = InlineKeyboardMarkup(inline_keyboard=keyboard)
        if is_edit: await message.edit_text("📂 Ваши заказы:", reply_markup=markup)
        else: await message.answer("📂 Ваши заказы:", reply_markup=markup)

    except: pass

# --- ПРОСМОТР ЗАКАЗА ---

@dp.callback_query(F.data.startswith("view_order_"))
async def process_view_order(call: CallbackQuery):
    order_id = call.data.split("_")[2]
    await link_user_to_order(order_id, call.from_user.id)

    try:
        async with aiohttp.ClientSession(connector=aiohttp.TCPConnector(ssl=False)) as session:
            async with session.get(f"{API_URL}/{order_id}") as resp:
                if resp.status != 200:
                    await call.answer("Заказ не найден", show_alert=True)
                    return
                order = await resp.json()
        
        await show_single_order(call.message, order, is_edit=True)
    except:
        await call.answer("Ошибка", show_alert=True)

async def show_single_order(message, order, is_edit=False):
    order_id = order.get('id')
    order_num = order.get('order_number')
    
    status_map = {"new": "🆕 Размещен", "in-progress": "⚙️ В работе", "completed": "✅ Готов", "canceled": "❌ Отменен"}
    pay_map = {"pending": "⏳ Не оплачен", "completed": "💰 Оплачено", "partial_paid": "🧩 Частично", "agreement_approved": "🤝 Договор"}
    
    text = (
        f"🔹 <b>Заказ #{order_num}</b>\n"
        f"📝 {order.get('subject')}\n"
        f"📊 {status_map.get(order.get('status'), '?')}\n"
        f"💰 {order.get('total')}₽ ({pay_map.get(order.get('payment_status'), '?')})\n"
    )

    keyboard = []
    if order.get('payment_status') == 'pending' and order.get('status') != 'canceled':
        total = float(order.get('total'))
        part = round(total/3, 2)
        keyboard.append([InlineKeyboardButton(text=f"💳 Оплатить ({total}₽)", callback_data=f"buy_full_{order_id}_{total}")])
        keyboard.append([InlineKeyboardButton(text=f"🧩 Предоплата ({part}₽)", callback_data=f"buy_part_{order_id}_{part}")])
        keyboard.append([InlineKeyboardButton(text=f"🤝 Договориться", callback_data=f"ask_agree_{order_id}")])

    keyboard.append([InlineKeyboardButton(text="🆘 Вопрос по заказу", callback_data=f"support_ask_{order_num}")])
    keyboard.append([InlineKeyboardButton(text="🔙 Назад", callback_data="my_orders")])

    markup = InlineKeyboardMarkup(inline_keyboard=keyboard)
    if is_edit: await message.edit_text(text, reply_markup=markup, parse_mode="HTML")
    else: await message.answer(text, reply_markup=markup, parse_mode="HTML")

# --- ДОГОВОРЕННОСТЬ И ОПЛАТА ---

@dp.callback_query(F.data.startswith("ask_agree_"))
async def ask_agreement(call: CallbackQuery):
    order_id = call.data.split("_")[2]
    user = call.from_user
    await link_user_to_order(order_id, user.id)
    await call.message.edit_text("⏳ Запрос админу отправлен...")
    try:
        await bot.send_message(ADMIN_ID, f"🤝 Договоренность? (ID {order_id}) @{user.username}", reply_markup=get_admin_approval_keyboard(order_id, user.id))
    except: pass

@dp.callback_query(F.data.startswith("buy_"))
async def process_buy_manual(call: CallbackQuery, state: FSMContext):
    _, type_, order_id, amount = call.data.split("_")
    await link_user_to_order(order_id, call.from_user.id)

    text = (
        f"💳 <b>Реквизиты (СБП)</b>\nБанк: <b>{SBP_BANK}</b>\nНомер: <code>{SBP_PHONE}</code>\n"
        f"Получатель: {RECIPIENT_NAME}\n💰 Сумма: <code>{amount}</code> ₽\n"
        f"📸 <b>Пришлите скриншот чека:</b>"
    )
    await call.message.edit_text(text, parse_mode="HTML")
    await state.set_state(BotStates.waiting_for_screenshot)
    await state.update_data(order_id=order_id, amount=amount, payment_type=type_)

@dp.message(BotStates.waiting_for_screenshot, F.photo)
async def handle_payment_screenshot(message: types.Message, state: FSMContext):
    data = await state.get_data()
    await link_user_to_order(data['order_id'], message.from_user.id)
    await message.answer("✅ Чек принят!")
    await state.clear()
    try:
        await message.forward(ADMIN_ID)
        await bot.send_message(ADMIN_ID, f"Оплата заказа {data['order_id']}?", reply_markup=get_payment_decision_keyboard(data['order_id'], message.from_user.id, data['payment_type']))
    except: pass

@dp.callback_query(F.data.startswith("conf_"))
async def admin_decision(call: CallbackQuery):
    parts = call.data.split("_")
    action, order_id, user_id = parts[1], parts[2], parts[3]
    if action == "reject":
        await call.message.edit_text("❌ Отклонено")
        try: await bot.send_message(user_id, f"❌ Оплата по заказу {order_id} отклонена.")
        except: pass
        return
    real_num = await notify_backend(order_id, action)
    if real_num:
        await call.message.edit_text(f"✅ Подтверждено #{real_num}")
        try: await bot.send_message(user_id, f"✅ Оплата заказа #{real_num} подтверждена!", reply_markup=get_return_keyboard())
        except: pass

# --- ПОДДЕРЖКА (ЧАТ) ---

@dp.callback_query(F.data.startswith("support_ask_"))
async def start_support_with_order(call: CallbackQuery, state: FSMContext):
    order_num = call.data.split("_")[2]
    await state.update_data(current_order_num=order_num)
    await state.set_state(BotStates.in_support_chat)
    await call.message.answer(f"🆘 Чат по заказу <b>#{order_num}</b>.\nПишите сообщение:", reply_markup=get_support_exit_keyboard(), parse_mode="HTML")
    await call.answer()

@dp.callback_query(F.data == "exit_support")
async def exit_support(call: CallbackQuery, state: FSMContext):
    await state.clear()
    await call.message.answer("✅ Диалог завершен.", reply_markup=get_return_keyboard())

# ===> ОБРАБОТКА КНОПКИ "ОТВЕТИТЬ" У ПОЛЬЗОВАТЕЛЯ <===
@dp.callback_query(F.data == "user_reply_support")
async def user_clicks_reply_button(call: CallbackQuery, state: FSMContext):
    # Пользователь нажал "Ответить" в сообщении от админа
    await state.set_state(BotStates.in_support_chat)
    await call.message.answer("✍️ Пишите ваш ответ поддержке:", reply_markup=get_support_exit_keyboard())
    await call.answer()

@dp.message(BotStates.in_support_chat)
async def handle_support_msg(message: types.Message, state: FSMContext):
    if message.text and message.text.startswith("/"): return
    
    data = await state.get_data()
    order_num = data.get('current_order_num', '?')
    
    # Защита если текст пустой (на случай стикеров)
    content = message.text or message.caption or "[Файл]"
    full_text = f"[Заказ #{order_num}] {content}"

    msg_url = API_URL.replace("/orders", "/messages/from-telegram")
    
    try:
        async with aiohttp.ClientSession(connector=aiohttp.TCPConnector(ssl=False)) as session:
            payload = {"telegramId": str(message.from_user.id), "content": full_text}
            async with session.post(msg_url, json=payload) as resp:
                if resp.status == 200:
                    await message.answer("✅ Отправлено!")
                    
                    # ШЛЕМ АДМИНУ (С кнопкой "Ответить пользователю")
                    try:
                        await bot.send_message(
                            ADMIN_ID, 
                            f"📩 <b>Support:</b>\n{full_text}\n(@{message.from_user.username})", 
                            parse_mode="HTML",
                            reply_markup=get_admin_reply_keyboard(message.from_user.id)
                        )
                    except Exception as e:
                        logging.error(f"Err admin: {e}")
                else:
                    await message.answer("❌ Ошибка доставки.")
    except:
        await message.answer("❌ Ошибка сети.")

# --- ОТВЕТ АДМИНА ---

@dp.callback_query(F.data.startswith("reply_to_"))
async def admin_click_reply(call: CallbackQuery, state: FSMContext):
    user_id = call.data.split("_")[2]
    await state.update_data(reply_target_id=user_id)
    await state.set_state(BotStates.admin_replying)
    await call.message.answer(f"✍️ Введите ответ для (ID {user_id}):")
    await call.answer()

# --- ДОБАВИТЬ ЭТУ ФУНКЦИЮ В БЛОК "ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ" ---

async def get_telegram_id_by_db_id(db_user_id):
    """Превращает ID базы данных (напр. 5) в Telegram ID (напр. 123456789)"""
    try:
        # Формируем URL: заменяем /orders на /users/{id}
        url = API_URL.replace("/orders", f"/users/{db_user_id}")
        
        async with aiohttp.ClientSession(connector=aiohttp.TCPConnector(ssl=False)) as session:
            async with session.get(url) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return data.get('telegram_id') # Вернет строку или None
                return None
    except Exception as e:
        logging.error(f"Error fetching TG ID: {e}")
        return None


# --- ОБНОВИТЬ ФУНКЦИЮ ОТПРАВКИ ОТВЕТА АДМИНА ---

# --- ОБНОВЛЕННАЯ ФУНКЦИЯ ОТВЕТА АДМИНА ---
@dp.message(BotStates.admin_replying)
async def admin_send_reply(message: types.Message, state: FSMContext):
    if message.from_user.id != ADMIN_ID: return
        
    data = await state.get_data()
    db_target_id = data.get('reply_target_id') # ID пользователя в базе (напр. 45)
    
    if not db_target_id:
        await message.answer("❌ Ошибка: Неизвестный получатель.")
        await state.clear()
        return

    # 1. Получаем Telegram ID для отправки
    real_telegram_id = await get_telegram_id_by_db_id(db_target_id)
    if not real_telegram_id:
        await message.answer("❌ Не найден Telegram ID пользователя.")
        await state.clear()
        return

    # Текст сообщения
    text_content = message.text or message.caption or "[Файл]"
    
    try:
        # А. Отправляем пользователю в ТГ (С кнопкой "Ответить")
        await bot.send_message(
            chat_id=real_telegram_id, 
            text=f"📩 <b>Ответ поддержки:</b>\n{html.escape(text_content)}", 
            parse_mode="HTML",
            reply_markup=get_user_reply_keyboard()
        )

        # Б. СОХРАНЯЕМ В БАЗУ ДАННЫХ САЙТА (Чтобы видно было в чате) !!!
        # Мы отправляем ID админа (ADMIN_ID) и ID получателя (db_target_id)
        msg_url = API_URL.replace("/orders", "/messages/from-telegram")
        async with aiohttp.ClientSession(connector=aiohttp.TCPConnector(ssl=False)) as session:
            payload = {
                "telegramId": str(ADMIN_ID),   # Это ТГ ID Админа
                "content": text_content,
                "recipientId": db_target_id    # Это ID юзера в базе, кому отвечаем
            }
            await session.post(msg_url, json=payload)

        await message.answer("✅ Ответ отправлен и сохранен.")

    except Exception as e:
        await message.answer(f"❌ Ошибка: {e}")
    
    await state.clear()

# --- АДМИНСКИЕ КНОПКИ ---
@dp.callback_query(F.data.startswith("adm_yes_"))
async def admin_accept_agree(call: CallbackQuery):
    _, _, order_id, user_id = call.data.split("_")
    real_num = await notify_backend(order_id, "agreement")
    if real_num:
        await call.message.edit_text(f"✅ Договорились #{real_num}")
        try: await bot.send_message(user_id, f"✅ Условия по заказу #{real_num} приняты!", reply_markup=get_return_keyboard())
        except: pass

@dp.callback_query(F.data.startswith("adm_no_"))
async def admin_reject_agree(call: CallbackQuery):
    _, _, order_id, user_id = call.data.split("_")
    await call.message.edit_text(f"❌ Отказ")
    try: await bot.send_message(user_id, f"❌ Отказ по заказу (ID {order_id}).", reply_markup=get_return_keyboard())
    except: pass

async def main():
    print("Бот запущен...")
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())
