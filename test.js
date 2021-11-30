const request = require('superagent');
const Promise = require('bluebird');
const credentials = require('./credentials.json');
const twilio = require('twilio');
const AccessToken = require('twilio').jwt.AccessToken;
const ChatGrant = AccessToken.ChatGrant;

const ROOT_URL = 'https://conversations.twilio.com/v1';
const auth = 'Basic ' + Buffer.from(`${credentials.aid}:${credentials.pwd}`).toString('base64');
const sidAuth = 'Basic ' + Buffer.from(`${credentials.sid}:${credentials.token}`).toString('base64');
const getTwilioUrl = url => {
    if (url.startsWith('http')) return url;
    return `${ROOT_URL}/${url}`;
};
const doTwilioGet = url => request.get(getTwilioUrl(url)).set('Authorization', auth).send().then(r => r.body);
const doTwilioPost = (url, data, Auth=auth) => request.post(getTwilioUrl(url)).set('content-type', 'application/x-www-form-urlencoded').set('Authorization', Auth).send(data).then(r => r.body).catch(err => {
    if (err.response)
        console.log(err.response.body);
    else
        console.log(err);
});

const sendTextMsg = async (toNum, data) => {
    const sid = credentials.sid;
    return await doTwilioPost(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
        `Body=${data}&From=%2B${credentials.twilioPhone}&To=%2B1${toNum}`, sidAuth);
}
async function test() {    
    const r = await doTwilioGet('Conversations');
    r.conversations.map(conv => {        
        console.log(conv)
    });
    const theConv = r.conversations[0];
    await testConv(theConv);
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
    //await sendTextMsg('4043989999','testtestdata')
}

test();