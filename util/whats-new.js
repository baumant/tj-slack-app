const axios = require("axios");
const db = require('../db');
const twit = require('./twit.js');

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
let twitterItems = [];

let scrapeTJ = await axios({
    url: 'https://www.traderjoes.com/api/graphql',
    method: 'post',
    data: {
      query: `
          query SearchProducts($currentPage: Int, $pageSize: Int = 256, $storeCode: String = "31", $availability: String = "1", $published: String = "1") {
            products(
              filter: {store_code: {eq: $storeCode}, published: {eq: $published}, availability: {match: $availability}, new_product: {match: "1"}}
              currentPage: $currentPage
              pageSize: $pageSize
            ) {
              items {
                sku
                item_title
                item_story_marketing
                primary_image
                other_images
                published
                sku
                url_key
                availability
                new_product
                promotion
                category_hierarchy {
                  id
                  name
                  __typename
                }
                primary_image
                sales_size
                sales_uom_description
                retail_price
                __typename
              }
              total_count
            }
          }          
          
        `
    }
  }).then((result) => {
    console.log(result.data.data.products);
    let products = result.data.data.products.items;
    for (let index = 0; index < products.length; index++) {
      const product = products[index];
      newItems.unshift({ item_title: product.item_title, item_url: "https://www.traderjoes.com/home/products/pdp/" + product.sku, item_img_url: "https://www.traderjoes.com" + product.primary_image, item_blurb: product.item_story_marketing });
    }
    console.log(newItems);
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

      // push new items to slack message blocks
      blocks.push(
        {
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": `*<${item.item_url}|${item.item_title}>*\n${item.item_blurb.substring(0, 500) + "..."}`
          },
          "accessory": {
            "type": "image",
            "image_url": `${item.item_img_url}`,
            "alt_text": item.item_title
          }
        },
        {
          "type": "divider"
        }
      );

      // push new items to twitter variable
      twitterItems.push({
        item_title: item.item_title, 
        item_url: item.item_url, 
        item_img_url: item.item_img_url, 
        item_blurb: item.item_blurb.substring(0, 500) + "..."
      })
    }
  }

  // post to channels where TJ has been installed
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

  //post to twitter
  twit.tweetNewItems(announcementText, twitterItems);

} else {
  console.log('no new items found.');
}

})();
