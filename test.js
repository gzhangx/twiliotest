const request = require('superagent');
const Promise = require('bluebird');
const credentials = require('./credentials.json');

const ROOT_URL = 'https://conversations.twilio.com/v1';
const auth = 'Basic '+Buffer.from(`${credentials.aid}:${credentials.pwd}`).toString('base64');
const doTwilioGet = url => request.get(url).set('Authorization', auth).send().then(r => r.body);
const doTwilioPost = (url, data) => request.post(url).set('content-type','application/x-www-form-urlencoded').set('Authorization', auth).send(data).then(r => r.body).catch(err => {
    console.log(err.response.body);
})
async function test() {    
    const convUrl = `${ROOT_URL}/Conversations`;
    const r = await doTwilioGet(convUrl);
    r.conversations.map(conv => {
        console.log(`sid = ${conv.sid}`);
        console.log(conv)
    });
    const theConv = r.conversations[0];
    await testConv(theConv);
}

async function testConv(conv) {
    if (!conv) return;
    const checkPartUrl = conv.links.participants;
    const parts = await doTwilioGet(checkPartUrl);
    console.log('conv parts')
    console.log(parts);
    console.log(parts.participants);
    console.log(parts.participants.length)
    console.log(checkPartUrl)
    //if (parts.participants.length === 0) {
        //%2B
    const r = await doTwilioPost(checkPartUrl, `MessagingBinding.Address=%2B1${credentials.myPhone}&MessagingBinding.ProxyAddress=%2B${credentials.twilioPhone}`)
        console.log('part res')
        console.log(r)
    //}
}

test();