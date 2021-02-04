const dotenv = require('dotenv');
const { App, LogLevel } = require('@slack/bolt');
const db = require('./db');

dotenv.config();

const fetchTeam = async (teamId) => {
  try {
    const res = await db.query("SELECT installation FROM slack_tokens WHERE teamid = '" + teamId + "'");
    const installation = JSON.parse(res.rows[0].installation.toString());
    return installation.team.id;
  } catch (e) {
    console.log(e);
  }
}

// Initializes your app with your bot token and signing secret
const app = new App({
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
      if (installation.team.id !== undefined) {
        try {
          var sql = "INSERT INTO slack_tokens (teamid, installation) VALUES ('" + installation.team.id + "', '" + JSON.stringify(installation) + "')";
          const res = await db.query(sql)
          console.log("The app was installed successfully.");
        } catch (err) {
          console.log(err.stack)
        }
      } else {
        throw new Error('Failed saving installation data to installationStore');
      }
    },
    fetchInstallation: async (InstallQuery) => {
      return await fetchTeam(InstallQuery.teamId);
    }
  }
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