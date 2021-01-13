const dotenv = require('dotenv');
const { App } = require('@slack/bolt');
const axios = require('axios');

dotenv.config()

// Initializes your app with your bot token and signing secret
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET
});

// Listens to incoming messages that contain "Trader Joe's"
app.message(/trader joe’*'*s/i, async ({ say }) => {
  // say() sends a message to the channel where the event was triggered
  await say("OMG I love Trader Joe's!!!");
});

app.message(/tj’*'*s/i, async ({ message, client }) => {
  try {
    const result = await client.reactions.add({
      token: client.botToken,
      channel: message.channel,
      name: 'eyes',
      timestamp: message.timestamp
    });
  }
  catch (error) {
    console.error(error);
  }
});

// app.message('TJ', async ({ message, say }) => {
//   // say() sends a message to the channel where the event was triggered
//   await say({
//     text: `Sup <@${message.user}>` 
//   });
// });

app.message(/what’*'*s good TJ/i, async ({message, say }) => {

  const getItem = await axios.get('https://api.apify.com/v2/datasets/AvdATgp5GXh8DIXar/items?token='+ process.env.APIFY_TOKEN)
  .then(res => {
    itemNum = Math.floor(Math.random() * 9);
    const itemTitle = res.data[itemNum].title;
    const itemUrl = res.data[itemNum].url;

    return {title: itemTitle, url: itemUrl};
  });

  await say({
    text: `have you tried the ${getItem.title}? https://traderjoes.com${getItem.url}`
  })

})

// app.action('new_item_click', async ({ body, ack, say }) => {
//   // Acknowledge the action
//   await ack();
//   await say(`<@${body.user.id}> clicked the button`);
// });

(async () => {
  // Start your app
  await app.start(process.env.PORT || 3005);

  console.log('⚡️ TJ is running! At ' + process.env.PORT || '3005');
})();