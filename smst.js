const request = require('superagent');
const Promise = require('bluebird');
const twilio = require('twilio');
const twilioConversionsImp = require('@twilio/conversations');

const credentials = require('./credentials.json');

const accountSid = credentials.twilio.sid;
const authToken = credentials.twilio.token;
const twilioClient = require('twilio')(accountSid, authToken);

async function deleteAll() {
    const r = await doTwilioGet('Conversations');
    await Promise.map(r.conversations, async conv => {
        const checkPartUrl1 = conv.links.participants;
        await doTwilloDel(conv.url);
    });
}

function mapMessage(m) {
    return {
        author: m.author,
        body: m.body,
        index: m.index,
        timestamp: m.dateCreated || m.date_created,
        id: m.sid,
        media: m.media,
        processor: 'twillio',
        source: 'sms',
        participantSid: m.participantSid || m.participant_sid,
        conversationSid: m.conversationSid || m.conversation_sid,
    }
}
async function getAllMessages(serviceId, onMsgs) {
    const r = await doTwilioGet(`Services/${serviceId}/Conversations`);
    let res = [];
    while (true) {
        const cur = await Promise.map(r.conversations, async conv => {
            //const serviceSid = conv.chat_service_sid; //'ISxxxxxxxxxxxxx';
            //const msgs = await doTwilioGet(`Services/${serviceSid}/Conversations/${conv.sid}/Messages?Order=desc&PageSize=50`);
            //onMsgs(msgs.messages.map(mapMessage));            
            const msgs = await twilioClient.conversations.conversations(conv.sid).messages.page({ order: 'desc', limit: 50, pageNumber: 0 })
            //nextPageUrl, previousPageUrl,instances[]
            console.log(msgs.instances[0])
            return await onMsgs(msgs.instances.map(mapMessage));
        });
        res = res.concat(cur);
        const nextPageUrl = r.meta.next_page_url
        if (nextPageUrl) {
            console.log(`pagging next ${nextPageUrl}`);
            r = await doTwilioGet(nextPageUrl);
        } else break;
    }
    return res;
}

async function generateToken(identity, serviceSid) {
    const twilioAccountSid = accountSid; //'ACxxxxxxxxxx';
    const twilioApiKey = credentials.twilio.aid; //'SKxxxxxxxxxx';
    const twilioApiSecret = credentials.twilio.pwd;

    // Used specifically for creating Chat tokens
    //const serviceSid =  //'ISxxxxxxxxxxxxx';

    const chatGrant = new twilio.jwt.AccessToken.ChatGrant({
        serviceSid: serviceSid,
    });

    // Create an access token which we will sign and return to the client,
    // containing the grant we just created
    const token = new twilio.jwt.AccessToken(
        twilioAccountSid,
        twilioApiKey,
        twilioApiSecret,
        { identity: identity }
    );

    token.addGrant(chatGrant);
    return token.toJwt();
}

function fixPhone(phone) {
    if (phone.length == 10) return `+1${phone}`;
    if (phone.length == 11) return `+${phone}`;
    return phone;
}


async function checkSms(serviceSid, phone, onMsg) {
    //await deleteAll();
    const tkIdentity = `GGID${phone}`;
    const token = await generateToken(tkIdentity, serviceSid);
    console.log(token)
    const client = new twilioConversionsImp.Client(token);
    await new Promise(resolve => {
        client.on('stateChanged', state => {
            console.log(`client state changed to =>${state}`);
            if (state === 'initialized') {
                resolve();
            }
        });
    });

    let conv = null;
    let alreadyExists = false;
    try {
        console.log('gt conv')
        conv = await client.getConversationByUniqueName(tkIdentity);
        alreadyExists = true;
        console.log('already exists')
    } catch {
        console.log('create conv')
        conv = await client.createConversation({
            friendlyName: 'ggfreiendlyname',
            uniqueName: tkIdentity,
        });
    }

    //console.log(conv.sid);
    conv.on('participantJoined', prt => {
        console.log(`partic joined ${phone}`)
    });

    if (onMsg) {
        conv.on('messageAdded', msg => {
            console.log(`message added ${phone}`);
            //console.log(msg); //conversation,  state
            console.log(`${msg.state.author}: ${msg.state.timestamp} ${msg.state.subject || ''} ${msg.state.body}`)
            onMsg(mapMessage(msg));
        });
    }
    //const allParts = await conv.getParticipants();
    //console.log(allParts.map(p=>p.state))
    if (!alreadyExists) {
        const addPartRes = await conv.addNonChatParticipant(fixPhone(credentials.twilio.twilioPhone), fixPhone(phone));
        console.log(`Addpart res=${addPartRes.sid}`);
    }
    //account_sid: 'AC0aa097
    //chat_service_sid: 'IS020154fc6
    //conversation_sid: 'CHe79897e3d
    //role_sid: 'RL7d38e296d0924498b
    //sid: 'MB2b17a9203b644c
    //date_created: '2021-12-01T20:58:29.243Z',
    //date_updated: '2021-12-01T20:58:29.243Z',
    //identity: null,
    //messaging_binding: {
    //type: 'sms',
    //    address: '+1xxxx',
    //        proxy_address: '+1xxxx'
    //},
    //url: 'https://aim.us1.twilio.com/Client/v2/Services/IS020154fc64564f8aa216d34ee162e4ef/Conversations/CHe79897e3d3d2413689cce65754dbfca6/Participants/MB2b17a9203b644cedaa5fdd2b248b8c7c',
    //    links: {
    //    conversation: 'https://aim.us1.twilio.com/Client/v2/Services/IS020154fc64564f8aa216d34ee162e4ef/Conversations/CHe79897e3d3d2413689cce65754dbfca6'
    //}
    if (!alreadyExists) {
        const addres = await conv.add(tkIdentity);
        console.log(`AddpartToConvo res=${addres.sid}`);
    }
    //await conv.sendMessage('testtest1');
    return conv;
}

const ROOT_URL = 'https://conversations.twilio.com/v1';
const auth = 'Basic ' + Buffer.from(`${credentials.twilio.aid}:${credentials.twilio.pwd}`).toString('base64');
const sidAuth = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');
const getTwilioUrl = url => {
    if (url.startsWith('http')) return url;
    return `${ROOT_URL}/${url}`;
};
const doTwilloDel = url => request.del(getTwilioUrl(url)).set('Authorization', auth).send().then(r => r.body)
const doTwilioGet = url => request.get(getTwilioUrl(url)).set('Authorization', auth).send().then(r => r.body);
const doTwilioPost = (url, data, Auth = auth) => request.post(getTwilioUrl(url)).set('content-type', 'application/x-www-form-urlencoded').set('Authorization', Auth).send(data).then(r => r.body).catch(err => {
    if (err.response)
        console.log(err.response.body);
    else
        console.log(err);
});


const sendTextMsg = async (toNum, data) => {
    return await doTwilioPost(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        `Body=${data}&From=%2B${credentials.twilioPhone}&To=%2B1${toNum}`, sidAuth);
}

return checkSms(credentials.twilio.serviceSidDontUse, '4043989999', msg => {
    console.log(msg);
})
return getAllMessages(credentials.twilio.serviceSidDontUse, msgs => console.log(msgs));


module.exports = {
    sendTextMsg,
    getAllMessages,
    checkSms,
}