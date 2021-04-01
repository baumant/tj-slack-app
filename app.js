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
    'im:write',
    'users:read'
  ],
  installationStore: {
    storeInstallation: async (installation) => {
      if (installation.team.id !== undefined) {
        let insertQuery = {};
        let params = [`${installation.team.id}`, JSON.stringify(installation)];
        insertQuery.text = 'INSERT INTO slack_tokens (teamid, installation) VALUES ($1, $2)';
        insertQuery.values = params;

        let updateQuery = {};

        updateQuery.text = 'UPDATE slack_tokens SET teamid = $1, installation = $2 WHERE teamid = $3';
        updateQuery.values = [`${installation.team.id}`, JSON.stringify(installation), `${installation.team.id}`];

        let onboardingBlocks = [
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
                "text": "❓Get help at any time with `/TJ help`"
              }
            ]
          }
        ];

        try {
          const result = await db.query(updateQuery);

          if(result.rowCount > 0){
            //onboarding welcome
            await app.client.chat.postMessage({
              token: installation.bot.token,
              channel: installation.user.id,
              blocks: onboardingBlocks
            });
          } else {
            try{
              const res = await db.query(insertQuery);

              //onboarding welcome
              await app.client.chat.postMessage({
                token: installation.bot.token,
                channel: installation.user.id,
                blocks: onboardingBlocks
              });
            }catch (error){
              console.log(error);
            }
          }
        }catch (error){
          console.log(error);
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
            "text": "❓Get help at any time with `/TJ help`"
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

app.message(/what’*'*s good,* TJ/i, async ({ say }) => {

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

const helpModal = {
	"type": "modal",
	"title": {
		"type": "plain_text",
		"text": "TJ Help",
		"emoji": true
	},
	"close": {
		"type": "plain_text",
		"text": "Got it!",
		"emoji": true
	},
	"blocks": [
		{
			"type": "header",
			"text": {
				"type": "plain_text",
				"text": "Need a recommendation?",
				"emoji": true
			}
		},
		{
			"type": "section",
			"text": {
				"type": "mrkdwn",
				"text": "ask me `What's good TJ?` or enter `/TJ recommend` and I'll give you a suggestion."
			}
		},
		{
			"type": "header",
			"text": {
				"type": "plain_text",
				"text": "Having issues with TJ?",
				"emoji": true
			}
		},
		{
			"type": "section",
			"text": {
				"type": "mrkdwn",
				"text": "Send an email to tim@slapps.me and we'll help you out!"
			}
		}
	]
};

app.command('/tj', async ({ command, ack, say, context }) => {
  try {
    // Acknowledge shortcut request
    await ack();

    if(command.text == 'help'){

      const result = await app.client.chat.postEphemeral({
        token: context.botToken,
        user: command.user_id,
        channel: command.channel_id,
        blocks: helpModal.blocks
      });
      console.log(result);

    } else if(command.text == 'recommend'){

      // connect to DB and get latest list of items for recommendation
      try {
        const commandUser = await app.client.users.info({
          token: context.botToken,
          user: command.user_id
        });
        console.log(commandUser);


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
              "text": `${commandUser.user.profile.display_name}, have you tried ${suggestedItem.item_title}?? Check it out:`,
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

    } else {
      await say("Sorry, I dont know that command. Try /tj help or /tj recommend");
    }
  }
  catch (error) {
    console.error(error);
  }
});

app.shortcut('tj_help', async ({ shortcut, ack, client }) => {

  try {
    // Acknowledge shortcut request
    await ack();

    // Call the views.open method using one of the built-in WebClients
    const result = await client.views.open({
      trigger_id: shortcut.trigger_id,
      view: helpModal
    });

    console.log(result);
  }
  catch (error) {
    console.error(error);
  }
});

customReceiver.app.set('view engine', 'pug');

customReceiver.router.get('/', (req, res) => {
  res.render('index', { title: "Meet TJ, the Trader Joe's superfan slack bot" })
});

customReceiver.app.use('/public', express.static('public'));

(async () => {
  // Start the app
  await app.start(process.env.PORT || 3005);
  console.log('⚡️ TJ is running! At' , process.env.PORT || '3005');
})();