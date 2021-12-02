const AWS = require('aws-sdk');
AWS.config.update({ region: 'us-east-2' });
const docClient = new AWS.DynamoDB.DocumentClient();

async function getAll(params, onData) {
    const onScan = (err, data) => {
        if (err) {
            onData(err);
        } else {
            onData(err, data); //data.items            
            // continue scanning if we have more items
            if (typeof data.LastEvaluatedKey != "undefined") {
                console.log("Scanning for more...");
                params.ExclusiveStartKey = data.LastEvaluatedKey;
                docClient.scan(params, onScan);
            }
        }
    };
    docClient.scan(params, onScan)
}

async function getAllByTable(TableName, FilterExpression, onData) {
    return getAll({
        TableName,
        FilterExpression
    }, onData);
}

async function addData(TableName, Item) {
    return await docClient.put({
        TableName,
        Item
    }).promise();
}

async function updateData(TableName, id,
    UpdateExpression,
    ExpressionAttributeValues    
) {
    return await docClient.update({
        TableName,
        Key: { id },
        UpdateExpression,
        ExpressionAttributeValues,
        ReturnValues:'UPDATED_NEW',
    }).promise();
}
async function test() {
    const customerTable = 'CustomerUser-kh7dnrwmljerze6banc6qglajq-staging';
    const addres = await addData(customerTable, {
        id: 'test1',
        email: 'gg@zz.com',
        phone: '411111111',
        name:'gg',
    });
    console.log(addres);
    const updateRes = await updateData(customerTable,
        'test1', 'set email=:email', {
        ":email": 'newemail'
    });
    console.log(updateRes);
    await getAllByTable(customerTable, null,(err, data) => {
        if (err) {
            console.log('error');
            console.log(err);
        } else {
            console.log(data);
        }
    });



}

test();