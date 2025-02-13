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
        status: {
            get_description: false,
            get_time: false
        },
        // params
        regDate: `${day}.${month}.${year}`
    })

    await saveStats();
    console.log(`New user, total: ${new_uid}`);

    return bot.sendMessage(chatId, `Hello Message for ToDoList`)
}

bot.setMyCommands([
    {command: '/start', description: 'Запуск'},
    {command: '/menu', description: 'Главное меню'},
    {command: '/help', description: 'Информация'}
])

bot.on('text', async msg => {
    if (msg.chat.type === 'supergroup' || msg.chat.type === 'group') return
    const chatId = msg.chat.id
    const user = await users.findOne({"id": chatId});

    if(!user) {
        await userRegistration(chatId, msg.chat.first_name);
    }

    if(user.status.get_description) {
        const task = await tasks.findOne({$and: [{"u_id": user.uid}, {"wait_for_accept": true}]});

        task.description = msg.text;
        user.status.get_description = false;

        await users.updateOne({"uid": user.uid}, {$set: user});
        await tasks.updateOne({$and: [{"u_id": user.uid}, {"wait_for_accept": true}]}, {$set: task});

        return bot.sendMessage(chatId, `Введите сроки для задачи в форме ДД.ММ (либо день месяц)`);
    }
    if(user.status.get_time) {
        const task = await tasks.findOne({$and: [{"u_id": user.uid}, {"wait_for_accept": true}]});

        task.wait_for_accept = false;
        user.status.get_time = false;

        await users.updateOne({"uid": user.uid}, {$set: user});
        await tasks.updateOne({$and: [{"u_id": user.uid}, {"wait_for_accept": true}]}, {$set: task});

        return bot.sendMessage(chatId, `Задача №${task.id} создана!
        
        Описание: ${task.description}
        Срок сдачи: ${task.time}`);
    }
})

bot.onText(/^(?:cghfdrf|справка|\/help|help|gjvjom|помощь)$/i, async (msg, match) => {
    const chatId = msg.chat.id;
    const user = await users.findOne({"id": chatId});

    return bot.sendMessage(chatId, `Help msg`)
})

bot.onText(/^(?:add|\/add|lj,fdbnm|адд|добавить|плюс)\s(.*)$/i, async (msg, match) => {
    const chatId = msg.chat.id;
    const user = await users.findOne({"id": chatId});

    let new_id = stats.tasks + 1;
    stats.tasks++;
    await saveStats();

    await tasks.insertOne({
        "id": new_id,
        "u_id": user.uid,
        "name": match[1],
        "description": null,
        "time": null,
        "overdue": null,
        "wait_for_accept": true
    })

    user.status.get_description = true;
    user.status.get_time = true;

    await users.updateOne({"uid": user.uid}, {$set: user});

    return bot.sendMessage(chatId, `Введите подробное описание для задачи:`);
})