/**
 * Worker ကို အသုံးပြုပြီး Telegram Bot Webhook ကို စီမံခန့်ခွဲသော Code (Admin Commands များပါဝင်သည်)
 */

// Bot Token ကို Cloudflare Worker ၏ Secrets (Environment Variables) မှ ရယူပါမည်။
const TELEGRAM_API = 'https://api.telegram.org/bot';

// Telegram Bot API ကို ခေါ်ဆိုသော function
async function sendMessage(token, chat_id, text) {
    const url = `${TELEGRAM_API}${token}/sendMessage`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chat_id,
            text: text,
            parse_mode: 'Markdown'
        })
    });
    return response.json();
}

// Commands များကို စီမံခန့်ခွဲသော function
// 🔑 ADMIN_CHAT_ID ကို လက်ခံရန် ထပ်တိုးထားသည်။
async function handleMessage(token, message, ADMIN_CHAT_ID) {
    const chat_id = message.chat.id;
    const text = message.text;
    const sender_id = message.from.id; // Command ရိုက်တဲ့သူရဲ့ ID
    const is_admin = String(sender_id) === String(ADMIN_CHAT_ID); // Admin ID နှင့် တိုက်စစ်ခြင်း

    if (!text) return;

    let responseText = "မရှင်းလင်းသော Command ဖြစ်ပါသည်။ /start သို့မဟုတ် /help ကို ရိုက်ထည့်ကြည့်ပါ။";

    // === USER COMMANDS ===
    if (text.startsWith('/start')) {
        responseText = `မင်္ဂလာပါ ${message.from.first_name}။ \n\nကျွန်ုပ်သည် KP Top Up ၏ အော်ဒါလက်ခံ Bot ဖြစ်ပါသည်။ \nCommands များသိရှိလိုပါက /help ကို ရိုက်ထည့်ပါ။`;
    } else if (text.startsWith('/help')) {
        responseText = "*အသုံးပြုနိုင်သော Commands များ*\n\n/start - Bot ကို စတင်ခြင်း\n/status - Bot ၏ အခြေအနေ စစ်ဆေးခြင်း";
        if (is_admin) {
            responseText += "\n\n*🔐 Admin Commands*\n/ban [ID] - အကောင့်ပိတ်ခြင်း\n/unban [ID] - အကောင့်ပိတ်ခြင်း ရုပ်သိမ်းခြင်း\n/banned - Ban စာရင်းကြည့်ခြင်း";
        }
    }
    
    // === 🔑 ADMIN COMMANDS LOGIC ===
    if (is_admin) {
        if (text.startsWith('/ban ')) {
            const userIdToBan = text.substring(5).trim();
            if (userIdToBan) {
                // TODO: ဒီနေရာတွင် Website မှာ စစ်တဲ့ Ban list (banned.json) ကို Update လုပ်မယ့် Logic ထည့်ရပါမည်။
                responseText = `✅ User ID: **${userIdToBan}** ကို Ban လုပ်ရန် စာရင်းသွင်းနေပါသည်။ (မှတ်ချက်- Ban list ကို update လုပ်မယ့် code ကို ထပ်ရေးရပါမည်)`;
            } else {
                responseText = "❌ Ban လုပ်မည့် User ID ကို ထည့်ပေးပါ။ ဥပမာ: /ban 123456789";
            }
        } else if (text.startsWith('/unban ')) {
            const userIdToUnban = text.substring(7).trim();
            if (userIdToUnban) {
                // TODO: ဒီနေရာတွင် Website မှာ စစ်တဲ့ Ban list (banned.json) မှ ဖယ်ရှားမယ့် Logic ထည့်ရပါမည်။
                responseText = `✅ User ID: **${userIdToUnban}** ကို Ban list မှ ဖယ်ရှားနေပါသည်။`;
            } else {
                responseText = "❌ Unban လုပ်မည့် User ID ကို ထည့်ပေးပါ။ ဥပမာ: /unban 123456789";
            }
        } else if (text.startsWith('/banned')) {
             // TODO: ဒီနေရာတွင် Ban list (banned.json) ကိုဖတ်ပြီး ပြန်ပို့မယ့် Logic ထည့်ရပါမည်။
             responseText = "📝 လက်ရှိ Ban လုပ်ထားသော စာရင်းကို ပြသပါမည်။ (မှတ်ချက်- list ဖတ်မယ့် code ထပ်လိုပါတယ်)";
        }
    } else if (text.startsWith('/ban') || text.startsWith('/unban') || text.startsWith('/banned')) {
        responseText = "🚫 သင်သည် ဤ Command ကို အသုံးပြုခွင့် မရှိပါ။";
    }
    // === END ADMIN COMMANDS LOGIC ===

    await sendMessage(token, chat_id, responseText);
}

// Worker ကို ဝင်ရောက်လာသော Request များကို စီမံခန့်ခွဲခြင်း
async function handleRequest(request, env) {
    const url = new URL(request.url);

    // 🔑 အရေးကြီး: BOT_TOKEN နှင့် ADMIN_CHAT_ID နှစ်ခုလုံးကို env မှ ရယူသည်။
    const BOT_TOKEN = env.BOT_TOKEN;
    const ADMIN_CHAT_ID = env.ADMIN_CHAT_ID;
    
    if (!BOT_TOKEN || !ADMIN_CHAT_ID) {
        return new Response('Error: BOT_TOKEN or ADMIN_CHAT_ID is not configured in Secrets.', { status: 500 });
    }

    if (request.method === 'POST') {
        try {
            const update = await request.json();
            if (update.message) {
                // 🔑 ADMIN_CHAT_ID ကို handleMessage function သို့ ပို့သည်။
                await handleMessage(BOT_TOKEN, update.message, ADMIN_CHAT_ID); 
            }
            return new Response('OK', { status: 200 }); 
        } catch (e) {
            console.error('Error processing update:', e);
            return new Response('Bad Request', { status: 400 });
        }
    }

    if (url.pathname === '/') {
        return new Response('KP Top Up Bot Worker is running.', { status: 200 });
    }

    return new Response('Not Found', { status: 404 });
}


// Worker Main Export
export default {
    async fetch(request, env, ctx) {
        return handleRequest(request, env);
    },
};
