const dotenv = require('dotenv');
const { App, LogLevel } = require('@slack/bolt');
const db = require('./db');

dotenv.config();

// Initializes your app with your bot token and signing secret
const app = new App({
  // token: process.env.SLACK_BOT_TOKEN,
  // signingSecret: process.env.SLACK_SIGNING_SECRET
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  clientId: process.env.SLACK_CLIENT_ID,
  clientSecret: process.env.SLACK_CLIENT_SECRET,
  stateSecret: 'tj-is-a-cutie',
  scopes: [
    'channels:read', 
    'chat:write', 
    'groups:history', 
    'im:history', 
    'incoming-webhook', 
    'links:read', 
    'mpim:history', 
    'reactions:write'
  ],
  logLevel: LogLevel.DEBUG,
  installationStore: {
    storeInstallation: async (installation) => {
      console.log('storeinstallation');
      // change the line below so it saves to your database
      if (installation.isEnterpriseInstall) {
        // support for org wide app installation
        // return await database.set(installation.enterprise.id, installation);
      } else {
        // single team app installation
        // return await database.set(installation.team.id, installation);
      }
      throw new Error('Failed saving installation data to installationStore');
    },
    fetchInstallation: async (installQuery) => {
      console.log('fetchinstallation', installQuery);
      // change the line below so it fetches from your database
      if (installQuery.isEnterpriseInstall && installQuery.enterpriseId !== undefined) {
        // org wide app installation lookup
        // return await database.get(installQuery.enterpriseId);
      }
      if (installQuery.teamId !== undefined) {
        // single team app installation lookup
        try {
          const res = await db.query('SELECT installation_id FROM auth WHERE installation_id = t8dspj45q')
          console.log(res);
          return res;
        } catch (err) {
          console.log(err.stack)
        }
      }
      // throw new Error('Failed fetching installation');
    },
  },
});

// Listens to incoming messages that contain "Trader Joe's"
app.message(/trader joe’*'*s/i, async ({ message, context }) => {
  try {
    const result = await app.client.reactions.add({
      token: context.botToken,
      name: 'hearts',
      channel: message.channel,
      timestamp: message.ts
    });
  }
  catch (error) {
    console.error(error);
  }
});

app.message(/tj’*'*s/i, async ({ message, context }) => {
  try {
    const result = await app.client.reactions.add({
      token: context.botToken,
      name: 'eyes',
      channel: message.channel,
      timestamp: message.ts
    });
  }
  catch (error) {
    console.error(error);
  }
});

app.message('TJ', async ({ message, context }) => {
  try {
    const result = await app.client.reactions.add({
      token: context.botToken,
      name: 'wave',
      channel: message.channel,
      timestamp: message.ts
    });
  }
  catch (error) {
    console.error(error);
  }
});

app.message(/what’*'*s good TJ/i, async ({ say }) => {

  // connect to DB and get latest list of items for recommendation
  try {
    const res = await db.query('SELECT * FROM new_items')
    console.log('grabbed items from database for reccomendation...');
    itemNum = Math.floor(Math.random() * (res.rows.length - 1));
    const suggestedItem = res.rows[itemNum];
    console.log(`recommending ${suggestedItem.item_title}.`);
    const blocks = [
      {
        "type": "section",
        "text": {
          "type": "plain_text",
          "text": `have you tried ${suggestedItem.item_title}?? Check it out:`,
          "emoji": true
        }
      },
      {
        "type": "divider"
      },
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": `*<https://www.traderjoes.com${suggestedItem.item_url}|${suggestedItem.item_title}>*\n${suggestedItem.item_blurb}`
        },
        "accessory": {
          "type": "image",
          "image_url": `https://www.traderjoes.com${suggestedItem.item_img_url}`,
          "alt_text": suggestedItem.item_title
        }
      }
    ]

    await say({ "blocks": blocks })
  } catch (err) {
    console.log(err.stack)
  }
});

(async () => {
  // Start your app
  await app.start(process.env.PORT || 3005);

  console.log('⚡️ TJ is running! At ' + process.env.PORT || '3005');
})();