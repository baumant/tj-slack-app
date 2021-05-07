const dotenv = require('dotenv');
const Twitter = require('twitter-lite');
const punycode = require('punycode');

const emoji_data = require('./emoji-pretty.json');

dotenv.config();

const user = new Twitter({
  consumer_key: process.env.TWITTER_API_KEY,
  consumer_secret: process.env.TWITTER_API_SECRET,
  access_token_key: process.env.TWITTER_ACCESS_TOKEN,  
  access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
});

const tweetNewItems = async (announcementText, twitterItems) => {
  console.log('TJ is getting ready to tweet!!');

  const twitterAnnouncementText = slackToUnicode(announcementText);

  for (let index = 0; index < twitterItems.length; index++) {
    const twitterItem = twitterItems[index];
    
    user.post('statuses/update', { 
      status: twitterAnnouncementText + " \n" + twitterItem.item_url
    }).then(result => {
      console.log('TJ successfully tweeted : "' + result.text + '"');
    }).catch(console.error);
  }
};

const slackToUnicode = (text) => {

  const emoji_re = /\:([a-zA-Z0-9\-_\+]+)\:(?:\:([a-zA-Z0-9\-_\+]+)\:)?/g;

  let new_text = text;

  // Find all Slack emoji in the message
  while(match=emoji_re.exec(text)) {
    let ed = emoji_data.find(function(el){
      return el.short_name == match[1];
    });
    if(ed) {
      var points = ed.unified.split("-");
      points = points.map(function(p){ return parseInt(p, 16) });
      new_text = new_text.replace(match[0], punycode.ucs2.encode(points));
    }
  }
  
  return new_text;
}

const client = new Twitter({
  version: "2",
  extension: false,
  consumer_key: process.env.TWITTER_API_KEY,
  consumer_secret: process.env.TWITTER_API_SECRET,
  access_token_key: process.env.TWITTER_ACCESS_TOKEN,  
  access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
});

const likeFollowRecentTJTweets = async () => {
  console.log('TJ is searching latest tweets');

  user
  .get("account/verify_credentials")
  .then(results => {
    const TJid = results.id;

    client.get('tweets/search/recent', {
      "query": "trader joe's -is:retweet -is:reply",
      "max_results": "100",
      "tweet.fields": "public_metrics",
      "expansions": "author_id"
    }).then(result => {
      const risingTweets = result.data.filter(tweet => (tweet.public_metrics.like_count > 2));
      console.log(risingTweets);
      console.log(risingTweets.length + " interesting tweets, throwing them a like & follow");

      for (let index = 0; index < risingTweets.length; index++) {
        const tweetID = risingTweets[index].id;
        user.post(`favorites/create`, {
          "id": tweetID,
        }).then(result => {
          console.log("favorited: " + result.favorited, result.text);
        }).catch((error) => { console.log(error.errors); });

        user.post('friendships/create', { "user_id": risingTweets[index].author_id }).then(result => {
          console.log("followed " + result.screen_name);
        }).catch((error) => { console.log(error.errors); });
      }
    }).catch(console.error);

  })
  .catch(console.error);
};

exports.likeFollowRecentTJTweets = likeFollowRecentTJTweets;
exports.tweetNewItems = tweetNewItems;

