const axios = require("axios");
const cheerio = require("cheerio");
const { Client } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

(async () => {

// connect to DB and get latest list of new items
let lastRun = [];

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

await client.connect()

try {
  const res = await client.query('SELECT * FROM new_items')
  console.log('grabbed lastRun from database');
  lastRun = res.rows;

} catch (err) {
  console.log(err.stack);
}

// scrape TJ whats new blog for latest items
let newItems = [];

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
      await client.query('INSERT INTO new_items (item_title, item_url, item_img_url, item_blurb) VALUES ($1, $2, $3, $4)', [item.item_title, item.item_url, item.item_img_url, item.item_blurb])
        .then(() => {
          console.log(`added ${item.item_title} to database.`);
        }).catch((error) => console.log(error));
    }
  }

} else {
  console.log('no new items found.');
}

client.end();

})();