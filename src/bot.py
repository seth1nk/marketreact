import asyncio
import logging
import aiohttp
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

# Реквизиты для перевода (СБП)
SBP_PHONE = "+7 950 050-98-68"
SBP_BANK = "ВТБ банк"
RECIPIENT_NAME = "Константин В."

# Адреса сервера (ИЗМЕНЕНО НА HTTP)
API_URL = "http://market.apt142.ru/api/internal/orders"
SITE_URL_TEXT = "http://market.apt142.ru/marketplace"

# ==========================================

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()
logging.basicConfig(level=logging.INFO)

class PaymentState(StatesGroup):
    waiting_for_screenshot = State()

def get_main_keyboard(order_id, total):
    part_price = round(float(total) / 3, 2)
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=f"💳 Оплатить всё ({total}₽)", callback_data=f"buy_full_{order_id}_{total}")],
        [InlineKeyboardButton(text=f"🧩 Предоплата 1/3 ({part_price}₽)", callback_data=f"buy_part_{order_id}_{part_price}")],
        [InlineKeyboardButton(text=f"🤝 По договоренности", callback_data=f"ask_agree_{order_id}")],
        [InlineKeyboardButton(text=f"📂 Мои заказы", callback_data="my_orders")]
    ])

def get_return_keyboard():
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📂 Список заказов", callback_data="my_orders")]
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

# --- УТИЛИТА ДЛЯ СВЯЗИ С СЕРВЕРОМ ---
async def notify_backend(order_id, type_):
    """Возвращает красивый номер заказа, если успех"""
    try:
        async with aiohttp.ClientSession() as session:
            # aiohttp автоматически работает с http://
            async with session.post(f"{API_URL}/{order_id}/confirm", json={"payment_type": type_}) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    # Возвращаем красивый номер (например 987654)
                    return data.get('order_number') 
                return None
    except Exception as e:
        logging.error(f"Error connecting to backend: {e}")
        return None

# --- ЛОГИКА ---

@dp.message(CommandStart())
async def cmd_start(message: types.Message, command: CommandObject, state: FSMContext):
    await state.clear()
    args = command.args
    if not args:
        await show_my_orders_logic(message, message.from_user.id)
        return

    order_id = args
    user_tg_id = message.from_user.id
    
    try:
        async with aiohttp.ClientSession() as session:
            payload = {"orderId": order_id, "telegramId": user_tg_id}
            async with session.post(f"{API_URL}/link-telegram", json=payload) as resp:
                if resp.status != 200:
                    await message.answer("❌ Заказ не найден.")
                    return
                order = await resp.json()

        total = order.get('total')
        subject = order.get('subject')
        
        text = (
            f"👋 <b>Оплата заказа</b>\n"
            f"📝 Тема: {subject}\n"
            f"💰 К оплате: <b>{total}₽</b>\n"
            "Выберите способ:"
        )
        await message.answer(text, reply_markup=get_main_keyboard(order_id, total), parse_mode="HTML")

    except Exception as e:
        logging.error(f"Error in start command: {e}")
        await message.answer("Ошибка сервера.")

@dp.callback_query(F.data.startswith("buy_"))
async def process_buy_manual(call: CallbackQuery, state: FSMContext):
    _, type_, order_id, amount = call.data.split("_")
    
    payment_name = "ПОЛНОЙ ОПЛАТЫ" if type_ == "full" else "ПРЕДОПЛАТЫ (1/3)"
    
    text = (
        f"💳 <b>Реквизиты (СБП)</b>\n"
        f"Банк: <b>{SBP_BANK}</b>\n"
        f"Получатель: <b>{RECIPIENT_NAME}</b>\n"
        f"Номер: <code>{SBP_PHONE}</code>\n\n"
        f"💰 Сумма: <code>{amount}</code> ₽\n"
        f"📝 Назначение: <b>{payment_name}</b>\n\n"
        f"📸 <b>ПРИШЛИТЕ СКРИНШОТ ЧЕКА СЮДА 👇</b>"
    )
    
    await call.message.edit_text(text, parse_mode="HTML")
    await state.set_state(PaymentState.waiting_for_screenshot)
    await state.update_data(order_id=order_id, amount=amount, payment_type=type_)

@dp.message(PaymentState.waiting_for_screenshot, F.photo)
async def handle_payment_screenshot(message: types.Message, state: FSMContext):
    data = await state.get_data()
    order_id = data['order_id']
    amount = data['amount']
    p_type = data['payment_type']
    user = message.from_user

    await message.answer("✅ Чек принят! Ожидайте подтверждения.", parse_mode="HTML")
    await state.clear()

    try:
        await message.forward(ADMIN_ID)
        admin_text = (
            f"🔔 <b>ОПЛАТА</b> (ID заказа: {order_id})\n"
            f"Юзер: @{user.username}\n"
            f"Сумма: {amount}₽ ({p_type})\n"
            f"Подтвердить?"
        )
        await bot.send_message(
            ADMIN_ID, admin_text, 
            reply_markup=get_payment_decision_keyboard(order_id, user.id, p_type),
            parse_mode="HTML"
        )
    except: pass

@dp.message(PaymentState.waiting_for_screenshot)
async def handle_invalid_msg(message: types.Message):
    await message.answer("📸 Нужен скриншот чека.")

# --- РЕШЕНИЕ АДМИНА ---

@dp.callback_query(F.data.startswith("conf_"))
async def admin_decision(call: CallbackQuery):
    parts = call.data.split("_")
    action = parts[1]
    order_id = parts[2] # Это ID из базы (21)
    user_id = parts[3]

    if action == "reject":
        await call.message.edit_text(f"❌ Отклонено (ID {order_id})")
        try:
            await bot.send_message(user_id, f"❌ Оплата по заказу (ID {order_id}) не подтверждена. Проверьте чек.")
        except: pass
        return

    # Подтверждение
    real_order_number = await notify_backend(order_id, action)
    
    if real_order_number:
        status_text = "ПОЛНАЯ оплата" if action == "full" else "Частичная оплата"
        await call.message.edit_text(f"✅ Подтверждено! Заказ #{real_order_number}")
        
        try:
            msg_to_user = (
                f"✅ <b>Оплата подтверждена!</b>\n"
                f"📦 <b>Заказ #{real_order_number}</b>\n"
                f"Тип: {status_text}\n"
                f"Статус: 🆕 <b>Заказ размещен</b> (Ожидает обработки)\n\n"
                f"Сайт: {SITE_URL_TEXT}"
            )
            await bot.send_message(user_id, msg_to_user, reply_markup=get_return_keyboard(), parse_mode="HTML")
        except: pass
    else:
        await call.answer("❌ Ошибка сервера! (Проверьте логи)", show_alert=True)

# --- СПИСОК ЗАКАЗОВ ---

@dp.message(Command("orders"))
@dp.callback_query(F.data == "my_orders")
async def show_orders_cmd(event: types.Message | CallbackQuery):
    if isinstance(event, CallbackQuery):
        msg = event.message
        tg_id = event.from_user.id
        await event.answer()
    else:
        msg = event
        tg_id = event.from_user.id
    
    await show_my_orders_logic(msg, tg_id)

async def show_my_orders_logic(message, user_id):
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{API_URL}/by-telegram/{user_id}") as resp:
                if resp.status != 200:
                    await message.answer("Нет заказов.")
                    return
                orders = await resp.json()

        if not orders:
            await message.answer("Список пуст.")
            return

        text = "📂 <b>ВАШИ ЗАКАЗЫ:</b>\n\n"
        
        # СТАТУСЫ КАК ТЫ ПРОСИЛ
        status_map = {
            "new": "🆕 Заказ размещен",
            "in-progress": "⚙️ В работе",
            "completed": "✅ Доставлен",
            "canceled": "❌ Отменен"
        }
        payment_map = {
            "pending": "⏳ Не оплачен",
            "completed": "💰 Оплачено",
            "partial_paid": "🧩 Частично (1/3)",
            "agreement_approved": "🤝 По договоренности"
        }

        for o in orders:
            s = status_map.get(o.get('status'), o.get('status'))
            p = payment_map.get(o.get('payment_status'), o.get('payment_status'))
            
            text += (
                f"🔹 <b>Заказ #{o.get('order_number')}</b>\n"
                f"├ Тема: {o.get('subject')}\n"
                f"├ Статус: <b>{s}</b>\n"
                f"└ Оплата: {p} — {o.get('total')}₽\n\n"
            )
        
        await message.answer(text, parse_mode="HTML")
    except Exception as e:
        logging.error(f"Error fetching orders: {e}")
        await message.answer("Ошибка списка.")

# --- ДОГОВОРЕННОСТЬ ---

@dp.callback_query(F.data.startswith("ask_agree_"))
async def ask_agreement(call: CallbackQuery):
    order_id = call.data.split("_")[2]
    user = call.from_user
    await call.message.edit_text("⏳ Запрос админу...")
    try:
        await bot.send_message(ADMIN_ID, f"🤝 Договоренность? (ID {order_id}) @{user.username}", reply_markup=get_admin_approval_keyboard(order_id, user.id))
    except: pass

@dp.callback_query(F.data.startswith("adm_yes_"))
async def admin_accept_agree(call: CallbackQuery):
    _, _, order_id, user_id = call.data.split("_")
    real_num = await notify_backend(order_id, "agreement")
    if real_num:
        await call.message.edit_text(f"✅ Договорились (Заказ #{real_num})")
        try:
            await bot.send_message(user_id, f"✅ Условия по заказу #{real_num} приняты!", reply_markup=get_return_keyboard())
        except: pass

@dp.callback_query(F.data.startswith("adm_no_"))
async def admin_reject_agree(call: CallbackQuery):
    _, _, order_id, user_id = call.data.split("_")
    await call.message.edit_text(f"❌ Отказ")
    try:
        await bot.send_message(user_id, f"❌ Отказ по заказу (ID {order_id}).")
    except: pass

async def main():
    print("Бот работает...")
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())