const dotenv = require('dotenv');
const { App } = require('@slack/bolt');
const axios = require('axios');
const { Client } = require('pg');

dotenv.config();

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

// app.message('TJ', async ({ message, say }) => {
//   // say() sends a message to the channel where the event was triggered
//   await say({
//     text: `Sup <@${message.user}>` 
//   });
// });

app.message(/what’*'*s good TJ/i, async ({message, say }) => {

  // connect to DB and get latest list of new items
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  await client.connect()

  try {
    const res = await client.query('SELECT * FROM new_items');
    console.log('grabbed items from database');
    itemNum = Math.floor(Math.random() * (res.rows.length - 1));
    const suggestedItem = res.rows[itemNum];

  } catch (err) {
    console.log(err.stack);
  }
  // const getItem = await axios.get('https://api.apify.com/v2/datasets/AvdATgp5GXh8DIXar/items?token='+ process.env.APIFY_TOKEN)
  // .then(res => {
  //   itemNum = Math.floor(Math.random() * 9);
  //   const itemTitle = res.data[itemNum].title;
  //   const itemUrl = res.data[itemNum].url;

  //   return {title: itemTitle, url: itemUrl};
  // });

  await say({
    text: `have you tried the ${suggestedItem.item_title}? https://traderjoes.com${suggestedItem.item_url}`
  })

});

(async () => {
  // Start your app
  await app.start(process.env.PORT || 3005);

  console.log('⚡️ TJ is running! At ' + process.env.PORT || '3005');
})();