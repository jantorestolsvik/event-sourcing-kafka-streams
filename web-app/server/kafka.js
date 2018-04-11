import uuidv4 from 'uuid/v4';
import bytesToUuid from 'uuid/lib/bytesToUuid'
import {Client, ConsumerGroup, HighLevelProducer} from 'kafka-node';

const defaultOptions = {keyEncoding: 'buffer'};

export const startConsumer = (topic, options, f) => {
  const mergedOptions = Object.assign({}, defaultOptions, options);
  const consumer = new ConsumerGroup(mergedOptions, topic);
  consumer.on('message', message => {
    f(bytesToUuid(message.key), JSON.parse(message.value));
  });
};

const client = new Client();
const commandsProducer = new HighLevelProducer(client);
const commandsTopic = 'invoice-commands';

commandsProducer.on('ready', () => {
  console.log('commands producer ready')
});

const uuidToBytes = uuid => Buffer.from(uuid.replace(/-/g, ''), 'hex');

const executeCommand = (invoiceId, commandPayload) => {
  const commandId = uuidv4();
  const command = {
    commandId: commandId,
    toEvents: commandPayload
  };
  const payload = {
    topic: commandsTopic,
    messages: [JSON.stringify(command)],
    key: uuidToBytes(invoiceId),
    timestamp: Date.now()
  };
  return new Promise((resolve, reject) => {
    commandsProducer.send([payload], err => {
      if (err) {
        reject(err);
      } else {
        resolve({commandId, invoiceId: invoiceId});
      }
    });
  });
};

export const createInvoice = draft => {
  return executeCommand(uuidv4(), {
    CreateInvoice: {
      customerName: draft.customer.name,
      customerEmail: draft.customer.email,
      issueDate: draft.issueDate,
      dueDate: draft.dueDate,
      lineItems: draft.lineItems
    }
  });
};

export const payInvoice = invoiceId => {
  return executeCommand(invoiceId, {PayInvoice: {}});
};
