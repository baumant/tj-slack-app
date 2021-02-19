const axios = require("axios");
const cheerio = require("cheerio");
const db = require('../db');

(async () => {

let lastRun = [];
let announcementText = '';

// query DB for latest list of new items
try {
  const res = await db.query('SELECT * FROM new_items')
  console.log('grabbed lastRun from database');
  lastRun = res.rows;
} catch (err) {
  console.log(err.stack)
}

// query DB for random announcement sentence
try {
  const res = await db.query('SELECT * FROM new_item_text_options')
  announcementText = res.rows;
  announcementText = announcementText[Math.floor(Math.random() * announcementText.length)].text;
  console.log('decided how to announce new item');
} catch (err) {
  console.log(err.stack)
}

// scrape TJ whats new blog for latest items
let newItems = [];
let blocks = [
  {
    "type": "section",
    "text": {
      "type": "plain_text",
      "text": announcementText,
      "emoji": true
    }
  },
  {
    "type": "divider"
  }
];

let scrapeTJ = await axios("https://www.traderjoes.com/digin/category/What's%20New")
  .then((response) => {
    const $ = cheerio.load(response.data);

    $('#contentbegin .article:not(.pagination-container)').each(function(index, e){
        const productUrl = $(e).find('a.no-underline').attr('href');
        const productTitle = $(e).find('a.no-underline h1').text();
        const productImage = $(e).find('.image-holder img').attr('src');
        const productBlurb = $(e).find('p:nth-of-type(3)').text();
        newItems.unshift({ item_title: productTitle, item_url: productUrl, item_img_url: productImage, item_blurb: productBlurb });
    });

  }).catch((error) => console.log(error));

console.log('scrape completed.');

// compare scrape and last run from DB
await scrapeTJ;

if(lastRun.findIndex(lastRunItem => lastRunItem.item_title === newItems[newItems.length - 1].item_title) == -1) {
  console.log('new items found. adding to database...');

  for (const item of newItems) {
    //if lastRun doesnt have item, add to DB
    const isInDatabase = lastRun.findIndex(lastRunItem => lastRunItem.item_title === item.item_title);

    if(isInDatabase == -1){
      // add item to DB
      try {
        await db.query('INSERT INTO new_items (item_title, item_url, item_img_url, item_blurb) VALUES ($1, $2, $3, $4)', [item.item_title, item.item_url, item.item_img_url, item.item_blurb])
        console.log(`added ${item.item_title} to database.`);
      } catch (err) {
        console.log(err.stack)
      }

      // push new items to message blocks
      blocks.push(
        {
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": `*<https://www.traderjoes.com${item.item_url}|${item.item_title}>*\n${item.item_blurb}`
          },
          "accessory": {
            "type": "image",
            "image_url": `https://www.traderjoes.com${item.item_img_url}`,
            "alt_text": item.item_title
          }
        },
        {
          "type": "divider"
        }
      );
    }
  }

  try {
    const res = await db.query('SELECT * FROM slack_tokens')
    // console.log(res.rows);
    let installations = res.rows;
  
    for (let i = 0; i < installations.length; i++) {
      const installation = JSON.parse(installations[i].installation.toString());
      console.log(installation.incomingWebhook.url);
      await axios.post(installation.incomingWebhook.url, { "blocks": blocks })
        .then(function (response) {
          console.log(response.status, `posted new item to ${installation.incomingWebhook.channel}`);
        })
        .catch(function (error) {
          console.log(error);
        });
  
    }
  } catch (err) {
    console.log(err.stack)
  }
  

} else {
  console.log('no new items found.');
}

})();
