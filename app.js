const TelegramApi = require('node-telegram-bot-api')
const {Keyboard, Key} = require('telegram-keyboard')
const {MongoClient} = require('mongodb');

const settings = require('./settings.json');

const bot = new TelegramApi(settings.token, {polling: true})
const mongo_db = new MongoClient(settings.mongo_link);

const run_database = async () => {
    try {
        await mongo_db.connect();
        console.log('Connected!')
    } catch (e) {
        console.log(e);
    }
}

run_database();

const users = mongo_db.db('todolistbot').collection('users');
const tasks = mongo_db.db('todolistbot').collection('tasks');
const stats = require(`./stats.json`);

async function saveStats() {
    require('fs').writeFileSync('./stats.json', JSON.stringify(stats, null, '\t'));
    return true;
}

setInterval(async () => {
    await saveStats();
}, 1000);

async function userRegistration(chatId, name) {
    const date = new Date();
    let month = date.getMonth() + 1 < 10 ? `0${date.getMonth() + 1}` : `${date.getMonth() + 1}`;
    let day = date.getDate() < 10 ? `0${date.getDate()}` : `${date.getDate()}`
    let year = date.getFullYear();

    let new_uid = stats.users + 1;
    stats.users++;

    await users.insertOne({
        uid: new_uid,
        id: chatId,
        name: name,
        // params
        regDate: `${day}.${month}.${year}`
    })

    await saveStats();
    console.log(`New user, total: ${new_uid}`);

    return bot.sendMessage(chatId, `Hello Message for ToDoList`)
}
bot.on('text', async msg => {
    if (msg.chat.type === 'supergroup' || msg.chat.type === 'group') return
    const chatId = msg.chat.id
    const user = await users.findOne({"id": chatId});

    if(!user) {
        await userRegistration(chatId, msg.chat.first_name);
    }
})