const dotenv = require('dotenv');
const { App, LogLevel, ExpressReceiver } = require('@slack/bolt');
const express = require('express');
const db = require('./db');

dotenv.config();

const fetchTeam = async (teamId) => {
  try {
    const res = await db.query("SELECT installation FROM slack_tokens WHERE teamid = '" + teamId + "'");
    return JSON.parse(res.rows[0].installation.toString());
  } catch (e) {
    console.log(e);
  }
}

const customReceiver = new ExpressReceiver({ 
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  clientId: process.env.SLACK_CLIENT_ID,
  clientSecret: process.env.SLACK_CLIENT_SECRET,
  stateSecret: 'tj-is-a-cutie',
  scopes: [
    'channels:read', 
    'channels:history',
    'chat:write', 
    'groups:history', 
    'im:history', 
    'incoming-webhook', 
    'links:read', 
    'mpim:history', 
    'reactions:write',
    'im:write'
  ],
  installationStore: {
    storeInstallation: async (installation) => {
      if (installation.team.id !== undefined) {
        try {
          var sql = "INSERT INTO slack_tokens (teamid, installation) VALUES ('" + installation.team.id + "', '" + JSON.stringify(installation) + "')";
          const res = await db.query(sql)
          console.log("The app was installed successfully.");
          
          //onboarding welcome
          await app.client.chat.postMessage({
            token: installation.bot.token,
            channel: installation.user.id,
            blocks: 
              [
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": "Hey there 👋 I'm TJ. I love Trader Joes and am always on top of their new releases."
                  }
                },
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": "➕ To get the latest and greatest from our boy Joe, *add me to a channel* and I'll introduce myself. I'm usually added to a casual conversation or lunch-based channel. Type `/invite @TJ` from the channel you selected during installation, or pick the channel on the right."
                  },
                  "accessory": {
                    "type": "conversations_select",
                    "placeholder": {
                      "type": "plain_text",
                      "text": "Select a channel...",
                      "emoji": true
                    }
                  }
                },
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": "*My other great skill is recommendations*. Once I'm added to a channel, simply ask me `What's good TJ?` or type `/TJ recommend` and I'll recommend some 🔥"
                  }
                },
                {
                  "type": "image",
                  "title": {
                    "type": "plain_text",
                    "text": "recommendation",
                    "emoji": true
                  },
                  "image_url": "https://api.slack.com/img/blocks/bkb_template_images/onboardingComplex.jpg",
                  "alt_text": "example TJ recommendation"
                },
                {
                  "type": "divider"
                },
                {
                  "type": "context",
                  "elements": [
                    {
                      "type": "mrkdwn",
                      "text": "👀 View all tasks with `/TJ list`\n❓Get help at any time with `/TJ help` or type *help* in a DM with me"
                    }
                  ]
                }
              ]
          });
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
  },
  logLevel: LogLevel.DEBUG
});

// Initializes your app with your bot token and signing secret
const app = new App({
  receiver: customReceiver
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

customReceiver.router.get('/secret-page', (req, res) => {
  // You're working with an express req and res now.
  res.send('yay!');
});

customReceiver.app.use('/public', express.static('/public'));

(async () => {
  // Start your app
  await app.start(process.env.PORT || 3005);

  console.log('⚡️ TJ is running! At ' + process.env.PORT || '3005');
})();