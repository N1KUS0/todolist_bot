const TelegramApi = require('node-telegram-bot-api')
const {Keyboard, Key} = require('telegram-keyboard')
const {MongoClient} = require('mongodb');
const {isValid, format} = require('date-fns');

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
clearAll();

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


const checkTime = setInterval(async () => {
    const tasks_ = await tasks.find().toArray();
    const date = new Date();
    let month = date.getMonth() + 1 < 10 ? `0${date.getMonth() + 1}` : `${date.getMonth() + 1}`;
    let day = date.getDate() < 10 ? `0${date.getDate()}` : `${date.getDate()}`
    let year = date.getFullYear(); 
    
    const now_date = `${day}.${month}.${year}`
    console.log(`Start Interval`)

    tasks_.map(async (task) => {
        const user = await users.findOne({"uid": task.u_id});
        if(user) {
            if(task.created != now_date && task.time != 'Без срока') {
                if(now_date == task.time) {
                    return bot.sendMessage(user.id, `Задача №${task.id} должна быть сегодня выполнена!`)
                } else if(now_date > task.time) {
                    return bot.sendMessage(user.id, `Задача №${task.id} просрочена!`)
                }
            }
        }
    })
}, 3600000);


function clearTimers() {
    clearInterval(checkTime);
}

async function clearAll() {
    const users_ = await users.find().toArray();
    users_.map(user => {
        clearUser(user.id);
    })
    const tasks_ = await tasks.find().toArray();
    tasks_.map(task => {
        if(task.wait_for_accept) task.deleteOne({$and: [{"id": task.id}, {"wait_for_accept": true}]})
    })

    clearTimers();
}

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

const months = {
    января: '01',
    февраля: '02',
    марта: '03',
    апреля: '04',
    мая: '05',
    июня: '06',
    июля: '07',
    августа: '08',
    сентября: '09',
    октября: '10',
    ноября: '11',
    декабря: '12',
};

async function clearUser(chatId) {
    const user = await users.findOne({"id": chatId});

    user.status.get_description = false;
    user.status.get_time = false;

    const task = await tasks.findOne({$and: [{"u_id": user.uid}, {wait_for_accept: true}]})
    if(task) {
        console.log(`clear user: ${user.name}, del task: ${task.name} (ID ${task.id})`)
        tasks.deleteOne({$and: [{"u_id": user.uid}, {wait_for_accept: true}]});
    }

    return users.updateOne({"id": chatId}, {$set: user});
}

function correctDate(dateString) {
    const [day, month, year] = dateString.split('.').map(Number);
    let date = new Date(year, month - 1, day);

  if (!isValid(date)) {
    date = new Date(year, month, 0);
  }

  return format(date, 'dd.MM.yyyy');
}

function formatTime(date) {
    let now_date = new Date();
    let new_date = now_date;
    let result_date = date;
    let form_date = 0;

    switch (date.toLowerCase()) {
        case 'сегодня':
        case 'ctujlyz':
        case 'today':
            form_date = 1;
            break;

        case `завтра`:
        case 'pfdnhf':
        case 'ltym':
        case 'день':
        case 'tomorrow':
            form_date = 1;
            new_date.setDate(now_date.getDate() + 1);
            break;

        case `ytltkz`:
        case 'неделя':
        case 'week':
            form_date = 1;
            new_date.setDate(now_date.getDate() + 7);
            break;

        default:
            try {
                result_date = result_date.replaceAll('/', '.')
                const parts = result_date.split('.');
                if(parts.length == 3) {
                    const [day, month, year] = parts;

                    let formDay = day.padStart(2, '0');
                    let formMonth = month.padStart(2, '0');
                    result_date = `${formDay}.${formMonth}.${year}`
                } else if(parts.length == 2) {
                    const [day, month] = parts;

                    let formDay = day.padStart(2, '0');
                    let formMonth = month.padStart(2, '0');
                    result_date = `${formDay}.${formMonth}.${now_date.getFullYear()}`
                }
            } catch {}
            const parts = date.split(' ');
            if(parts.length == 2) {
                const [day, month] = parts;

                if(months[month.toLowerCase()]) {
                    let formDay = day.padStart(2, '0');
                    result_date = `${formDay}.${months[month.toLowerCase()]}.${now_date.getFullYear()}`
                }
            }
            break;
    }
    if(['дней', 'дн', 'дня', 'lytq', 'lyz', 'ly', 'days'].some(word => date.toLowerCase().includes(word))) {
        let days = parseInt(date, 10)
        new_date.setDate(now_date.getDate() + days);
        form_date = 1;
    }
    if(form_date == 1) {
        let new_month = new_date.getMonth() + 1 < 10 ? `0${new_date.getMonth() + 1}` : `${new_date.getMonth() + 1}`;
        let new_day = new_date.getDate() < 10 ? `0${new_date.getDate()}` : `${new_date.getDate()}`
        result_date = `${new_day}.${new_month}.${new_date.getFullYear()}`
    }
    const regex = /^\d{2}\.\d{2}.\d{4}$/;
    let formated = regex.test(result_date);
    if(formated) {
        result_date = correctDate(result_date);
        return result_date;
    }
        else { 
            result_date = `Без срока`
            return result_date
        }   
}

bot.setMyCommands([
    {command: '/start', description: 'Запуск'},
    {command: '/menu', description: 'Главное меню'},
    {command: '/help', description: 'Информация'}
])

function checkBanWord(txt) {
    if(['/help', '/menu', '/add', '/info', '/list'].includes(txt)) return 1;
    else return 0;
}

bot.on('text', async msg => {
    if (msg.chat.type === 'supergroup' || msg.chat.type === 'group') return
    const chatId = msg.chat.id
    const user = await users.findOne({"id": chatId});

    if(!user) {
        await userRegistration(chatId, msg.chat.first_name);
    }

    if(checkBanWord(msg.text)) return;

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
        task.time = formatTime(msg.text);
        user.status.get_time = false;

        await users.updateOne({"uid": user.uid}, {$set: user});
        await tasks.updateOne({$and: [{"u_id": user.uid}, {"wait_for_accept": true}]}, {$set: task});

        return bot.sendMessage(chatId, `Задача №${task.id} создана!
        
        Название: ${task.name}
        Описание: ${task.description}
        Срок сдачи: ${task.time}`);
    }
})

bot.onText(/^(?:cghfdrf|справка|\/help|help|gjvjom|помощь)$/i, async (msg, match) => {
    const chatId = msg.chat.id;
    const user = await users.findOne({"id": chatId});

    await clearUser(chatId);
    return bot.sendMessage(chatId, `Help msg`)
})

bot.onText(/^(?:add|\/add|lj,fdbnm|адд|добавить|плюс)\s(.*)$/i, async (msg, match) => {
    const chatId = msg.chat.id;
    const user = await users.findOne({"id": chatId});

    const date = new Date();
    let month = date.getMonth() + 1 < 10 ? `0${date.getMonth() + 1}` : `${date.getMonth() + 1}`;
    let day = date.getDate() < 10 ? `0${date.getDate()}` : `${date.getDate()}`
    let year = date.getFullYear();

    await clearUser(chatId);

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
        "created": `${day}.${month}.${year}`,
        "wait_for_accept": true
    })

    user.status.get_description = true;
    user.status.get_time = true;

    await users.updateOne({"uid": user.uid}, {$set: user});

    return bot.sendMessage(chatId, `Введите подробное описание для задачи:`);
})


bot.onText(/^(?:list|\/list|cgbcjr|список|задачи|tasks)$/i, async (msg, match) => {
    const chatId = msg.chat.id;
    const user = await users.findOne({"id": chatId});

    const user_tasks = await tasks.find({"u_id": user.u_id}).toArray();
    
})