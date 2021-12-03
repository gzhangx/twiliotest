const request = require('superagent');
const Promise = require('bluebird');
const credentials = require('./credentials.json');
const twilio = require('twilio');
const AccessToken = twilio.jwt.AccessToken;
const ChatGrant = AccessToken.ChatGrant;
const twilioConversionsImp = require('@twilio/conversations');
const ConversationsClient = twilioConversionsImp.Client;

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
        timestamp: m.date_created,
        id: m.sid,
        media: m.media,
        processor: 'twillio',
        source: 'sms',
        participant_sid: m.participant_sid,
        conversation_sid: m.conversation_sid,
    }
}
async function getAllMessages(serviceId) {
    const r = await doTwilioGet(`Services/${serviceId}/Conversations`);
    await Promise.map(r.conversations, async conv => {            
        const serviceSid = conv.chat_service_sid; //'ISxxxxxxxxxxxxx';
        const msgs = await doTwilioGet(`Services/${serviceSid}/Conversations/${conv.sid}/Messages`);
        console.log(msgs.messages.map(mapMessage));
    });
}

async function generateToken(identity) {
    const twilioAccountSid = credentials.sid; //'ACxxxxxxxxxx';
    const twilioApiKey = credentials.aid; //'SKxxxxxxxxxx';
    const twilioApiSecret = credentials.pwd;

    const serviceSid = credentials.serviceSid;
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
async function testAll(phone) {
    //await deleteAll();
    const tkIdentity = `GGID${phone}`;
    const token = await generateToken(tkIdentity);
    const client = new twilioConversionsImp.Client(token);
    console.log(token);
    await new Promise(resolve => {
        client.on('stateChanged', state => {
            console.log(`client state changed to =>${state}`);
            if (state === 'initialized') {
                resolve();
            }
        });
    });
    console.log('client ready');
        
    let conv = null;
    let alreadyExists = false;
    try {
        conv = await client.getConversationByUniqueName(tkIdentity);
        alreadyExists = true;
    } catch {
        conv = await client.createConversation({
            friendlyName: 'ggfreiendlyname',
            uniqueName: tkIdentity,
        });
    }
    
    console.log(conv.sid);
    conv.on('participantJoined', prt => {
        console.log('partic joined')
    })
    conv.on('messageAdded', msg => {
        console.log('message added');
        //console.log(msg); //conversation,  state
        console.log(`${msg.state.author}: ${msg.state.timestamp} ${msg.state.subject||''} ${msg.state.body}`)
    });
    //const allParts = await conv.getParticipants();
    //console.log(allParts.map(p=>p.state))
    if (!tkIdentity)
    {
        const addPartRes = await conv.addNonChatParticipant(fixPhone(credentials.twilioPhone), fixPhone(phone));
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
    if (!tkIdentity)
    {
        const addres = await conv.add(tkIdentity);
        console.log(`AddpartToConvo res=${addres.sid}`);
    }
    //await conv.sendMessage('testtest1')
}

const showOldMessages = false;

const ROOT_URL = 'https://conversations.twilio.com/v1';
const auth = 'Basic ' + Buffer.from(`${credentials.aid}:${credentials.pwd}`).toString('base64');
const sidAuth = 'Basic ' + Buffer.from(`${credentials.sid}:${credentials.token}`).toString('base64');
const getTwilioUrl = url => {
    if (url.startsWith('http')) return url;
    return `${ROOT_URL}/${url}`;
};
const doTwilloDel = url => request.del(getTwilioUrl(url)).set('Authorization', auth).send().then(r => r.body)
const doTwilioGet = url => request.get(getTwilioUrl(url)).set('Authorization', auth).send().then(r => r.body);
const doTwilioPost = (url, data, Auth=auth) => request.post(getTwilioUrl(url)).set('content-type', 'application/x-www-form-urlencoded').set('Authorization', Auth).send(data).then(r => r.body).catch(err => {
    if (err.response)
        console.log(err.response.body);
    else
        console.log(err);
});

return testAll(credentials.myPhone);
return getAllMessages(credentials.serviceSid);
const sendTextMsg = async (toNum, data) => {
    const sid = credentials.sid;
    return await doTwilioPost(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
        `Body=${data}&From=%2B${credentials.twilioPhone}&To=%2B1${toNum}`, sidAuth);
}
async function test() {    
    const r = await doTwilioGet('Conversations');
    //r.conversations.map(conv => {        
    //    console.log(conv)
    //});
    //console.log(r)
    await getAllMessagesOld(r.conversations);
    //const theConv = r.conversations[0];
    //await testConv(theConv);
}


async function getAllMessagesOld(conversions) {
    const registeredServices = {
        ids: {},
        count: 0,
    };
    await Promise.map(conversions, async conv => {
        //await testConv(conv);
        const serviceSid = conv.chat_service_sid; //'ISxxxxxxxxxxxxx';        
        const checkPartUrl1 = conv.links.participants;
        const parts1 = await doTwilioGet(checkPartUrl1);
        console.log(`get parts serviceSid=${serviceSid} ${checkPartUrl1} ${parts1.participants.length}`);
        if (!parts1.participants.length) {
            console.log(conv.url)
            await doTwilloDel(conv.url);
        }
        console.log('-=------------------------')
        //console.log(conv) messaging_service_sid: 'MG39c2eae9201f14e sid: 'CH86b0db3b43a2
        if (parts1.participants.length === 1) {
            const checkPartUrl = conv.links.participants;
            console.log(`set particpiants ${checkPartUrl} converid=${conv.sid}`);
        
            //const r = await doTwilioPost(checkPartUrl, `Identity=STUP_${conv.sid}&MessagingBinding.ProjectedAddress=%2B4041111111`)
            console.log('only have 1 parts');
            if (showOldMessages) console.log(r);
        }
        console.log(`Registring testConvService`);
        if (!registeredServices.ids[serviceSid]) {
            registeredServices.ids[serviceSid] = true;
            registeredServices.count++;
            await testConvService(serviceSid);
        }
        await Promise.map(parts1.participants, async part => {
            const chid1 = part.conversation_sid;
            console.log(`Services/${serviceSid}/Conversations/${chid1}/Messages`);
            if (showOldMessages)console.log(part);
            //if (!part.identity) {
                ///await doTwilioPost(part.url, `Identity=testid1`);
            //}
            const msgs = await doTwilioGet(`Services/${serviceSid}/Conversations/${chid1}/Messages`);
            console.log('message from text count=' + msgs.messages.length)
            if (showOldMessages)console.log(msgs.messages.map(m => m.body));
        });
            
        
    }, { concurrency: 1 });
    console.log(`all conversion count ${conversions.length}, ids used: ${registeredServices.count} (should be 1)`);
}


async function testConvService(serviceSid) {
    const twilioAccountSid = credentials.sid; //'ACxxxxxxxxxx';
    const twilioApiKey = credentials.aid; //'SKxxxxxxxxxx';
    const twilioApiSecret = credentials.pwd;

    // Used specifically for creating Chat tokens
    //const serviceSid =  //'ISxxxxxxxxxxxxx';
    const identity = 'gzhang1@example.com';
    const chatGrant = new ChatGrant({
        serviceSid: serviceSid,
    });

    // Create an access token which we will sign and return to the client,
    // containing the grant we just created
    const token = new AccessToken(
        twilioAccountSid,
        twilioApiKey,
        twilioApiSecret,
        { identity: identity }
    );

    token.addGrant(chatGrant);

    // Serialize the token to a JWT string
    console.log(token.toJwt());

    const conversationsClient = new ConversationsClient(token.toJwt());
    conversationsClient.on("connectionStateChanged", (state) => {
        console.log(`convclient state ${state}`);
    });
    conversationsClient.on("conversationJoined", async (conversation) => {
        console.log('joined');
        conversation.on('messageAdded', msg => {
            console.log(`message added conversion with serviceSid ${serviceSid}`);
            //console.log(Object.keys(msg));
            console.log(`${msg.state.author} ${msg.state.body} `); //author,   sid.index,subject,body,timestamp,participantSid
        })
        conversation.on('updated', evn => {
            console.log(`updated serviceSid ${serviceSid}`);
            //console.log(Object.keys(evn));
            //console.log(evn.updateReasons);
        })

        const sendRes = await conversation.prepareMessage()
            .setBody('Hello from conversation sid ' + serviceSid)
            .setAttributes({ foo: 'bar' })
            .build()
            .send();

        console.log(sendRes)
        //const checkPartUrl = conv.links.participants;
        //console.log(`set particpiants ${checkPartUrl}`);
        //TODO do we need htis?
        //const r = await doTwilioPost(checkPartUrl, `MessagingBinding.Address=%2B1${credentials.myPhone}&MessagingBinding.ProxyAddress=%2B${credentials.twilioPhone}`)
        //console.log('part res')
        //console.log(r)
        //console.log(conversation);
        return;
        
    });
    conversationsClient.on("conversationLeft", (thisConversation) => {
        console.log('left');
        console.log(thisConversation);
    });    
}

async function testConv(conv) {
    if (!conv) return;

    const twilioAccountSid = credentials.sid; //'ACxxxxxxxxxx';
    const twilioApiKey = credentials.aid; //'SKxxxxxxxxxx';
    const twilioApiSecret = credentials.pwd;

    // Used specifically for creating Chat tokens
    const serviceSid = conv.chat_service_sid; //'ISxxxxxxxxxxxxx';
    const identity = 'gzhang1@example.com';
    const chatGrant = new ChatGrant({
        serviceSid: serviceSid,
    });

    // Create an access token which we will sign and return to the client,
    // containing the grant we just created
    const token = new AccessToken(
        twilioAccountSid,
        twilioApiKey,
        twilioApiSecret,
        { identity: identity }
    );

    token.addGrant(chatGrant);

    // Serialize the token to a JWT string
    console.log(token.toJwt());

    const conversationsClient = new ConversationsClient(token.toJwt());
    conversationsClient.on("connectionStateChanged", (state) => {
        console.log(`convclient state ${state}`);        
    });
    conversationsClient.on("conversationJoined", async (conversation) => {
        console.log('joined');
        conversation.on('messageAdded', msg => {
            console.log(`message added conversion`);
            //console.log(Object.keys(msg));
            console.log(`${msg.state.author} ${msg.state.body} `); //author,   sid.index,subject,body,timestamp,participantSid
        })
        conversation.on('updated conversation', evn => {
            console.log('updated');
            //console.log(Object.keys(evn));
            //console.log(evn.updateReasons);
        })

        const checkPartUrl = conv.links.participants;
        console.log(`set particpiants ${checkPartUrl}`);
        //TODO do we need htis?
        //const r = await doTwilioPost(checkPartUrl, `MessagingBinding.Address=%2B1${credentials.myPhone}&MessagingBinding.ProxyAddress=%2B${credentials.twilioPhone}`)
        //console.log('part res')
        //console.log(r)
        //console.log(conversation);
        return;
        const sendRes = await conversation.prepareMessage()
            .setBody('Hello from conversation')
            .setAttributes({ foo: 'bar' })
            .build()
            .send();

        console.log(sendRes)
    });
    conversationsClient.on("conversationLeft", (thisConversation) => {
        console.log('left');
        console.log(thisConversation);
    });
    return;
    //console.log('before create conv');
    //const cnv = await conversationsClient.createConversation();    
    const cnv = await conversationsClient.getConversationBySid("CH6ffef5a5d5be401a8ae12a62a97c76ec");
    cnv.on('messageAdded', msg => {
        console.log(`message added`);
        console.log(Object.keys(msg));
        console.log(`${msg.state.author} ${msg.state.body} `); //author,   sid.index,subject,body,timestamp,participantSid
    })
    cnv.on('updated', evn => {
        console.log('updated'); //'conversation', 'updateReasons'
        //console.log(Object.keys(evn));
        //console.log(evn.updateReasons);
    })
    try {
        //await cnv.join();
    } catch (exc) {
        console.log(`join error ${exc.message}`);
    }
    return;
    //const sendRes = await cnv.sendMessage('test from conv');
    const sendRes = await cnv.prepareMessage()
        .setBody('Hello from conv')
        .setAttributes({ foo: 'bar' })        
        .build()
        .send();

    console.log(sendRes)
    //console.log(cnv)
    //console.log('after create conv');
    //await cnv.sendMessage('testtttt');
    return;
    //conversationsClient.sendMessage('test')
    
    const checkPartUrl = conv.links.participants;
    const parts = await doTwilioGet(checkPartUrl);
    console.log('conv parts')
    console.log(parts);
    console.log(parts.participants);
    console.log(parts.participants.length)
    console.log(checkPartUrl);

    
    const chid = parts.participants[0].conversation_sid;
    await doTwilioPost(`Conversations/${chid}/Messages`, `Author=${identity}&Body=testtest`);
    return;
    //if (parts.participants.length === 0) {
        //%2B
    const r = await doTwilioPost(checkPartUrl, `MessagingBinding.Address=%2B1${credentials.myPhone}&MessagingBinding.ProxyAddress=%2B${credentials.twilioPhone}`)
        console.log('part res')
        console.log(r)
    //}

    //await doTwilioPost(`Users`,'Identity=testgg1')
    //const chid = 'CH2fb401fd48ec400ea5826bb7925610a4';
    ////await doTwilioPost(`Conversations/${chid}/Messages`, `Author=system&Body=testtest`);
    
    console.log(`send msg`);
    //await sendTextMsg('#####','testtestdata')
}

test();