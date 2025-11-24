/**
 * Cloudflare Worker: Telegram Bot + KV Ban System Logic
 */
const TELEGRAM_API = 'https://api.telegram.org/bot';
const ADMIN_CHAT_ID = "7070690379"; // Replace with your actual Admin Chat ID

// ... (sendMessage function is the same)
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
// ...

// Commands များကို စီမံခန့်ခွဲသော function
async function handleMessage(token, message, env) {
    const chat_id = message.chat.id;
    const text = message.text;
    const sender_id = message.from.id; 
    const is_admin = String(sender_id) === String(env.ADMIN_CHAT_ID); 

    if (!text) return;

    let responseText = "မရှင်းလင်းသော Command ဖြစ်ပါသည်။ /start သို့မဟုတ် /help ကို ရိုက်ထည့်ကြည့်ပါ။";

    // === USER COMMANDS (SAME AS BEFORE) ===
    if (text.startsWith('/start')) {
        responseText = `မင်္ဂလာပါ ${message.from.first_name}။ \n\nကျွန်ုပ်သည် KP Top Up ၏ အော်ဒါလက်ခံ Bot ဖြစ်ပါသည်။ \nCommands များသိရှိလိုပါက /help ကို ရိုက်ထည့်ပါ။`;
    } else if (text.startsWith('/help')) {
        responseText = "*အသုံးပြုနိုင်သော Commands များ*\n\n/start - Bot ကို စတင်ခြင်း\n/status - Bot ၏ အခြေအနေ စစ်ဆေးခြင်း";
        if (is_admin) {
            responseText += "\n\n*🔐 Admin Commands*\n/ban [ID] - အကောင့်ပိတ်ခြင်း\n/unban [ID] - အကောင့်ပိတ်ခြင်း ရုပ်သိမ်းခြင်း\n/banned - Ban စာရင်းကြည့်ခြင်း";
        }
    }
    
    // === ADMIN COMMANDS LOGIC (UPDATED WITH KV) ===
    if (is_admin) {
        const BAN_STORAGE = env.BAN_STORAGE; // KV Binding Name

        if (text.startsWith('/ban ')) {
            const userIdToBan = text.substring(5).trim();
            if (userIdToBan) {
                // KV ထဲတွင် Key: User ID, Value: "BANNED" အနေနဲ့ ထည့်သွင်းသည်။
                await BAN_STORAGE.put(userIdToBan, "BANNED"); 
                responseText = `✅ User ID: **${userIdToBan}** ကို KV Ban list သို့ ထည့်သွင်းလိုက်ပါပြီ။`;
            } else {
                responseText = "❌ Ban လုပ်မည့် User ID ကို ထည့်ပေးပါ။ ဥပမာ: /ban 123456789";
            }
        } else if (text.startsWith('/unban ')) {
            const userIdToUnban = text.substring(7).trim();
            if (userIdToUnban) {
                // KV မှ Key ကို ဖျက်သည်။
                await BAN_STORAGE.delete(userIdToUnban); 
                responseText = `✅ User ID: **${userIdToUnban}** ကို Ban list မှ ဖယ်ရှားလိုက်ပါပြီ။`;
            } else {
                responseText = "❌ Unban လုပ်မည့် User ID ကို ထည့်ပေးပါ။ ဥပမာ: /unban 123456789";
            }
        } else if (text.startsWith('/banned')) {
             // KV မှ Ban list အားလုံးကို ဖတ်သည်။
             const list = await BAN_STORAGE.list();
             const keys = list.keys.map(k => k.name).join('\n');
             
             if (keys.length > 0) {
                 responseText = `📝 *လက်ရှိ Ban လုပ်ထားသော User ID စာရင်း (${list.keys.length})*\n\n${keys}`;
             } else {
                 responseText = "✅ Ban လုပ်ထားသော User ID များ မရှိပါ။";
             }
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

    const BOT_TOKEN = env.BOT_TOKEN;
    
    if (!BOT_TOKEN || !env.ADMIN_CHAT_ID || !env.BAN_STORAGE) {
         // BAN_STORAGE binding မရှိရင် Error ပြရန်
        return new Response('Error: Worker environment is not fully configured.', { status: 500 });
    }

    // === 🔑 အပိုင်းသစ်: Frontend Website မှ Ban Status စစ်ဆေးရန် Endpoint ===
    if (url.pathname.startsWith('/check-ban/')) {
        const userId = url.pathname.substring('/check-ban/'.length);
        if (!userId) {
            return new Response(JSON.stringify({ banned: false }), { headers: { 'Content-Type': 'application/json' } });
        }
        
        // KV မှ User ID ကို တိုက်ရိုက်စစ်ဆေးသည်။
        const isBanned = await env.BAN_STORAGE.get(userId); 
        
        return new Response(JSON.stringify({ banned: isBanned !== null }), { // isBanned is null if key not found
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } // CORS အတွက် Allow Origin ထည့်ပေးရမည်
        });
    }
    // === အပိုင်းသစ် ပြီးဆုံး ===

    if (request.method === 'POST') {
        try {
            const update = await request.json();
            if (update.message) {
                await handleMessage(BOT_TOKEN, update.message, env); // env object တစ်ခုလုံးကို ပို့သည်။
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
