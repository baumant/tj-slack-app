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
    'channels:history',
    'channels:read',
    'channels:join',
    'chat:write', 
    'commands',
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
                    "action_id": "add_tj_to_channel",
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
                  "image_url": "https://tj-slack-app.herokuapp.com/public/recommendation.png",
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
                      "text": "❓Get help at any time with `/TJ help` or type *help* in a DM with me"
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

// add TJ to a channel from the intro message
app.action('add_tj_to_channel', async ({ action, context, ack, say }) => {
  // Acknowledge action request
  await ack();

  const channelID = action.selected_conversation;
  console.log(context);
  
  try {
    await app.client.conversations.join({
      token: context.botToken,
      channel: channelID
    });
    
    const res = await db.query('SELECT * FROM new_items ORDER BY ID DESC LIMIT 1')
    const exampleItem = res.rows[0];

    const channelJoinedMessage = [
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": "Hi everyone 👋 I'm TJ. I love Trader Joes and I'm always the first to know when they release something new! When something new comes out, I'll add it to this channel like this:"
        }
      },
      {
        "type": "divider"
      },
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": `*<https://www.traderjoes.com${exampleItem.item_url}|${exampleItem.item_title}>*\n${exampleItem.item_blurb}`
        },
        "accessory": {
          "type": "image",
          "image_url": `https://www.traderjoes.com${exampleItem.item_img_url}`,
          "alt_text": exampleItem.item_title
        }
      },
      {
        "type": "divider"
      },
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": "*I can also give some great recommendations of unique Trader Joe's items*. Simply ask me `What's good TJ?` or type `/TJ recommend` and I'll recommend some 🔥"
        }
      },
      {
        "type": "divider"
      },
      {
        "type": "context",
        "elements": [
          {
            "type": "mrkdwn",
            "text": "❓Get help at any time with `/TJ help` or type *help* in a DM with me"
          }
        ]
      }
    ];

    // post hello mesage in channel
    const result = await app.client.chat.postMessage({
      token: context.botToken,
      channel: action.selected_conversation,
      blocks: channelJoinedMessage
    });
    console.log(result);

    await say('I joined the channel!');

  }
  catch (error) {
    console.error(error);
    await say('Sorry, there was a problem joining that channel.');
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

const helpText = [
  {
    "type": "section",
    "text": {
      "type": "plain_text",
      "text": `help text testing`,
      "emoji": true
    }
  }
]

app.command('/tj help', async ({ command, ack, say, context }) => {
  await ack();
  console.log(command, context);

  const result = await app.client.chat.postEphemeral({
    token: context.botToken,
    channel: command.channel,
    blocks: helpText
  });
  console.log(result);
  
});

app.shortcut('tj_help', async ({ shortcut, ack, client }) => {

  try {
    // Acknowledge shortcut request
    await ack();

    console.log(shortcut, client);
    
    // Call the views.open method using one of the built-in WebClients
    const result = await client.views.open({
      trigger_id: shortcut.trigger_id,
      view: {
        type: "modal",
        title: {
          type: "plain_text",
          text: "My App"
        },
        close: {
          type: "plain_text",
          text: "Close"
        },
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "About the simplest modal you could conceive of :smile:\n\nMaybe <https://api.slack.com/reference/block-kit/interactive-components|*make the modal interactive*> or <https://api.slack.com/surfaces/modals/using#modifying|*learn more advanced modal use cases*>."
            }
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: "Psssst this modal was designed using <https://api.slack.com/tools/block-kit-builder|*Block Kit Builder*>"
              }
            ]
          }
        ]
      }
    });

    console.log(result);
  }
  catch (error) {
    console.error(error);
  }
});

app.command('/tj recommend', async ({ command, ack, say }) => {
  await ack();
  await say('todo: add recommendation here...');
});

app.shortcut('tj_recommend', async ({ ack, say }) => {  
  await ack();
  await say('todo: add recommendation here...');
});


customReceiver.router.get('/', (req, res) => {
  // You're working with an express req and res now.
  res.send('homepage');
});

customReceiver.app.use('/public', express.static('public'));

(async () => {
  // Start your app
  await app.start(process.env.PORT || 3005);
  console.log('⚡️ TJ is running! At' , process.env.PORT || '3005');
})();