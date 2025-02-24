/**
 * This script is for a Lambda that ingests the  data from a POST request from API Gateway,
 * logs some of the information to dynamo db and sends the body of the request with a
 * unique id on to two different SQS Queues.
 *
 */
const AWS = require('aws-sdk');

//Logs the request information to Dynamo DB
function logNewReq(unique_id, request_info) {
    let client_id = request_info.user_id;

    console.log(
        'logging new request ',
        { request_id, request_id },
        typeof request_info,
    );

    const dbParams = {
        TableName: 'gateway_requests',
        Item: {
            client_id,
            unique_id,
            name: request_info.name,
            status: 'enqueued',
            created_at: new Date().toString(),
            updated_at: new Date().toString(),
            location: request_info.location,
            target: request_info.target,
            recipient_email: request_ifno.email,
            set_live: request_info.set_live,
        },
    };

    const docClient = new AWS.DynamoDB.DocumentClient();

    return docClient.put(dbParams).promise();
}

/**
 * Handles our Lambda event
 * @param {*} event
 * @param {*} context
 */
exports.handler = async (event, context) => {
    console.log('Incoming event: ', event);

    const SQS = new AWS.SQS();

    let queue1_name = 'register-request-queue.fifo';
    const queue1_url = (
        await SQS.getQueueUrl({ QueueName: queue1_name }).promise()
    ).QueueUrl;

    const enqueue_params = {
        QueueUrl: queue1_url,
        MessageGroupId: 'prod',
        MessageBody: event,
    };

    var unique_id = context.awsRequestId;

    // before we send the message, lets create a new record in dynamo db
    // with everything that we need from the request
    let event_body = event.body;
    if (typeof event_body === 'string') {
        event_body = JSON.parse(event_body);
    }

    try {
        await logNewRequest(unique_id, event_body);
    } catch (error) {
        console.error('ERROR LOGGING NEW REQUEST TO DYNAMO DB', error);

        return {
            statusCode: 500,
            body: 'Error adding message to dynamodb',
        };
    }

    event_body.unique_id = unique_id;
    enqueue_params.MessageBody.body = event_body;

    // we need to stringify the message body
    enqueue_params.MessageBody = JSON.stringify(enqueue_params.MessageBody);

    console.log('Enqueueing new request with parameters: ', enqueue_params);

    const enqueue_results = await SQS.sendMessage(enqueue_params).promise();

    if (!enqueue_results) {
        console.error('Error adding request to queue');

        return {
            statusCode: 500,
            body: 'Error adding request to queue',
        };
    }

    let queue2_name = 'notify-request-queue.fifo';
    const queue2_url = (
        await SQS.getQueueUrl({ QueueName: queue2_name }).promise()
    ).QueueUrl;

    const enqueue_params = {
        QueueUrl: queue2_url,
        MessageGroupId: 'prod',
        MessageBody: event,
    };

    enqueue_params.MessageBody.body = event_body;

    const enqueue2_results = await SQS.sendMessage(enqueue_params).promise();

    if (!enqueue2_results) {
        console.error('Error adding request to queue');

        return {
            statusCode: 500,
            body: 'Error adding request to queue',
        };
    }

    return {
        statusCode: 200,
        body: JSON.stringify({ unique_id }),
    };
};
