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
      status: twitterAnnouncementText + " \nhttps://www.traderjoes.com" + twitterItem.item_url
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

exports.tweetNewItems = tweetNewItems;

